import {
  generateText,
  stepCountIs,
  type ToolSet,
  type ModelMessage,
} from 'ai';
import { env } from '../../config/env.js';
import { renderSystemPrompt } from '../systemPrompts.js';
import { LlmFinishReasonError } from './errors.js';
import {
  buildLlmRequestTokenUsage,
  logLlmInvalidRawResponse,
  logLlmRequest,
  logLlmResponse,
  logLlmToolCalls,
} from './logging.js';
import { buildTutorChatRoomTools } from './chatRoomTools.js';
import { buildTutorPracticeModuleTools, extractInferredPracticeModuleLinkBlocks } from './practiceModuleTools.js';
import { buildTranslatorSystemInstruction, buildAgentSystemInstruction } from './prompt.js';
import { getConfiguredModelId, getLanguageModel, getProviderOptions, getUserFacingFinishReasonMessage, shouldUseTemperature } from './providers.js';
import { appendStructuredCorrectionRequest, buildStructuredValidationReason, extractGeneratedTextFromError, isCorrectableLlmOutputError } from './corrections.js';
import { translationResultSchema } from './schemas.js';
import { blocksToMarkdown, toModelMessage, validateTutorResponseBlocks } from './validation.js';
import type { LlmRequestOptions, LlmRequestTokenUsage, TranslationMode, TranslationResult, TutorAgentResult, TutorMessage, TutorResponseBlock, TutorResponseValidator } from './types.js';

const firstChallengePrompt = renderSystemPrompt('tutor/start-session.md');

const maxAgentTurns = 6;

function mergeTutorPracticeModuleLinkBlocks(
  blocks: TutorResponseBlock[],
  inferredLinks: Array<Extract<TutorResponseBlock, { type: 'practice_module_link' }>>,
): TutorResponseBlock[] {
  const seenPracticeModuleIds = new Set(
    blocks
      .filter(
        (block): block is Extract<TutorResponseBlock, { type: 'practice_module_link' }> =>
          block.type === 'practice_module_link',
      )
      .map((block) => block.practiceModuleId),
  );

  return [
    ...blocks,
    ...inferredLinks.filter((link) => !seenPracticeModuleIds.has(link.practiceModuleId)),
  ];
}

async function continueTutorResponseAfterToolUse(input: {
  abortSignal?: AbortSignal;
  llm?: LlmRequestOptions;
  system: string;
  toolResults: Array<{
    output: unknown;
    preliminary?: boolean;
    toolName: string;
  }>;
}) {
  const finalizedToolResults = input.toolResults.filter((result) => !result.preliminary);
  const messages: ModelMessage[] = [
    {
      content: renderSystemPrompt('tutor/internal-tool-continuation.md', {
        TOOL_RESULTS_JSON: JSON.stringify(
          finalizedToolResults.map((result) => ({
            output: result.output,
            toolName: result.toolName,
          })),
          null,
          2,
        ),
      }),
      role: 'user',
    },
  ];

  return generateText({
    abortSignal: input.abortSignal,
    maxOutputTokens: 1800,
    messages,
    model: getLanguageModel(input.llm),
    providerOptions: getProviderOptions(),
    system: input.system,
    temperature: shouldUseTemperature(input.llm) ? 0.25 : undefined,
  });
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`JSON parsing failed: ${message}`);
  }
}

function extractEmbeddedTutorResponseJson(text: string): string | null {
  const blocksIndex = text.indexOf('"blocks"');
  if (blocksIndex === -1) {
    return null;
  }

  const startIndex = text.lastIndexOf('{', blocksIndex);
  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1).trim();
      }
    }
  }

  return null;
}

function looksLikeJsonAttempt(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('```json') ||
    trimmed.startsWith('```')
  );
}

function buildFallbackBlocksFromPlainText(input: {
  text: string;
  toolResults: Array<{
    output: unknown;
    preliminary?: boolean;
    toolName: string;
  }>;
}): TutorResponseBlock[] {
  const inferredLinks = extractInferredPracticeModuleLinkBlocks(input.toolResults);
  const trimmedText = input.text.trim();

  if (!trimmedText) {
    return inferredLinks.length > 0
      ? inferredLinks
      : [{ type: 'message', markdown: 'Listo.' }];
  }

  return mergeTutorPracticeModuleLinkBlocks(
    [{ type: 'message', markdown: trimmedText }],
    inferredLinks,
  );
}

export async function runTutorAgentLoop(
  history: TutorMessage[],
  options: {
    chatRoomReport?: {
      chatRoomConversationId: string;
      reportSummaryDescription: string;
      reportSummaryTitle: string;
      roomDescription: string;
      roomTitle: string;
      slidesJson: string;
    } | null;
    practiceModule?: {
      description: string;
      title: string;
      tutorInstructions: string;
    } | null;
    abortSignal?: AbortSignal;
    currentTitle?: string;
    currentPracticeModuleId?: string | null;
    llm?: LlmRequestOptions;
    onTokenUsage?: (usage: LlmRequestTokenUsage) => void;
    onToolCall?: (toolName: string) => void;
    profileId?: string | null;
    startConversation?: boolean;
    titleUpdatedByUser?: boolean;
    userId?: string | null;
    validateBlocks?: TutorResponseValidator;
  },
): Promise<TutorAgentResult> {
  const messages = history.map(toModelMessage);

  if (options.startConversation || messages.length === 0) {
    messages.push({
      content: firstChallengePrompt,
      role: 'user',
    });
  }

  const system = buildAgentSystemInstruction({
    ...options,
  });
  let lastError: unknown = null;
  const practiceModuleTools = buildTutorPracticeModuleTools({
    currentPracticeModuleId: options.currentPracticeModuleId ?? null,
    onToolCall: options.onToolCall,
    profileId: options.profileId ?? null,
    userId: options.userId ?? null,
  });
  const chatRoomTools = buildTutorChatRoomTools({
    onToolCall: options.onToolCall,
    profileId: options.profileId ?? null,
    userId: options.userId ?? null,
  });
  const mergedTools = {
    ...(practiceModuleTools || {}),
    ...(chatRoomTools || {}),
  };
  const tools: ToolSet | undefined = Object.keys(mergedTools).length > 0
    ? (mergedTools as ToolSet)
    : undefined;

  for (let turn = 0; turn < maxAgentTurns; turn += 1) {
    logLlmRequest(messages, system, options, turn + 1);

    try {
      const result = await generateText({
        abortSignal: options.abortSignal,
        maxOutputTokens: 1800,
        messages,
        model: getLanguageModel(options.llm),
        providerOptions: getProviderOptions(),
        stopWhen: stepCountIs(6),
        system,
        temperature: shouldUseTemperature(options.llm) ? 0.45 : undefined,
        tools,
      });
      logLlmToolCalls({
        steps: result.steps,
        turn: turn + 1,
      });
      const toolResults = result.steps.flatMap((step) => step.toolResults);
      let effectiveResult = result;
      let finalBlocks: TutorResponseBlock[] | null = null;
      let parsedObject: unknown = null;
      const initialText = result.text.trim();

      if (!initialText) {
        finalBlocks = buildFallbackBlocksFromPlainText({
          text: result.text,
          toolResults,
        });
      } else {
        try {
          parsedObject = parseJsonFromModelText(result.text);
          finalBlocks = mergeTutorPracticeModuleLinkBlocks(
            validateTutorResponseBlocks(parsedObject),
            extractInferredPracticeModuleLinkBlocks(toolResults),
          );
        } catch (error) {
          const embeddedJson = extractEmbeddedTutorResponseJson(result.text);

          if (embeddedJson) {
            try {
              parsedObject = parseJsonFromModelText(embeddedJson);
              finalBlocks = mergeTutorPracticeModuleLinkBlocks(
                validateTutorResponseBlocks(parsedObject),
                extractInferredPracticeModuleLinkBlocks(toolResults),
              );
            } catch (embeddedError) {
              logLlmInvalidRawResponse({
                error: embeddedError,
                rawText: result.text,
                turn: turn + 1,
              });
              throw embeddedError;
            }
          } else if (!looksLikeJsonAttempt(result.text)) {
            finalBlocks = buildFallbackBlocksFromPlainText({
              text: result.text,
              toolResults,
            });
          } else {
            effectiveResult = await continueTutorResponseAfterToolUse({
              abortSignal: options.abortSignal,
              llm: options.llm,
              system,
              toolResults,
            });

            try {
              parsedObject = parseJsonFromModelText(effectiveResult.text);
              finalBlocks = mergeTutorPracticeModuleLinkBlocks(
                validateTutorResponseBlocks(parsedObject),
                extractInferredPracticeModuleLinkBlocks(toolResults),
              );
            } catch (continuationError) {
              logLlmInvalidRawResponse({
                error: continuationError,
                rawText: effectiveResult.text,
                turn: turn + 1,
              });
              throw continuationError;
            }
          }
        }
      }

      logLlmResponse(
        parsedObject ?? { blocks: finalBlocks },
        effectiveResult.finishReason,
        effectiveResult.usage,
        effectiveResult.providerMetadata,
        turn + 1,
      );
      options.onTokenUsage?.(
        await buildLlmRequestTokenUsage({
          llm: options.llm,
          messages,
          system,
          turn: turn + 1,
          usage: effectiveResult.usage,
        }),
      );

      const userFacingFinishMessage = getUserFacingFinishReasonMessage(
        effectiveResult.finishReason,
        undefined,
        effectiveResult.providerMetadata,
      );
      if (userFacingFinishMessage) {
        throw new LlmFinishReasonError(
          result.finishReason,
          userFacingFinishMessage,
        );
      }

      try {
        if (!finalBlocks || finalBlocks.length === 0) {
          throw new Error('The model returned no usable response blocks.');
        }
        options.validateBlocks?.(finalBlocks);

        return {
          blocks: finalBlocks,
          content: blocksToMarkdown(finalBlocks),
          model: getConfiguredModelId(options.llm),
          provider: env.llmProvider,
        };
      } catch (error) {
        lastError = error;

        if (turn >= maxAgentTurns - 1) {
          throw error;
        }

        appendStructuredCorrectionRequest(messages, {
          error,
          invalidOutput: effectiveResult.text,
          reason: buildStructuredValidationReason(error),
          turn: turn + 1,
        });
      }
    } catch (error) {
      lastError = error;

      if (
        error instanceof LlmFinishReasonError ||
        !isCorrectableLlmOutputError(error)
      ) {
        throw error;
      }

      if (turn >= maxAgentTurns - 1) {
        throw error;
      }

      appendStructuredCorrectionRequest(messages, {
        error,
        invalidOutput: extractGeneratedTextFromError(error),
        reason:
          'Your previous response was not valid JSON or could not be converted into a TutorResponse object.',
        turn: turn + 1,
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('The model did not return a usable structured response.');
}

export async function translateTextWithLlm(input: {
  llm?: LlmRequestOptions;
  mode: TranslationMode;
  text: string;
}): Promise<TranslationResult> {
  const text = input.text.trim();
  if (!text) {
    throw new Error('No hay texto para traducir.');
  }

  const result = await generateText({
    maxOutputTokens: 1000,
    messages: [{ content: text, role: 'user' }],
    model: getLanguageModel(input.llm),
    providerOptions: getProviderOptions(),
    system: buildTranslatorSystemInstruction(input.mode),
    temperature: shouldUseTemperature(input.llm) ? 0.15 : undefined,
  });

  const userFacingFinishMessage = getUserFacingFinishReasonMessage(
    result.finishReason,
    undefined,
    result.providerMetadata,
  );
  if (userFacingFinishMessage) {
    throw new LlmFinishReasonError(
      result.finishReason,
      userFacingFinishMessage,
    );
  }

  const parsed = translationResultSchema.safeParse(parseJsonFromModelText(result.text));
  if (!parsed.success) {
    console.error('[Mr. F translator validation failed]', JSON.stringify({
      issues: parsed.error.issues,
      value: result.text,
    }, null, 2));
    throw new Error('El traductor no devolvió una respuesta válida.');
  }

  console.log('[Mr. F translator response]', JSON.stringify({
    detectedLanguage: parsed.data.detectedLanguage,
    mode: input.mode,
    model: getConfiguredModelId(input.llm),
    provider: env.llmProvider,
  }, null, 2));

  return {
    detectedLanguage: parsed.data.detectedLanguage,
    model: getConfiguredModelId(input.llm),
    provider: env.llmProvider,
    translatedText: parsed.data.translatedText,
  };
}

export * from './types.js';
export * from './errors.js';
