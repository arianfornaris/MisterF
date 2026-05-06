import {
  generateText,
  stepCountIs,
  type ToolSet,
  type ModelMessage,
} from 'ai';
import { env } from '../../config/env.js';
import { LlmFinishReasonError } from './errors.js';
import {
  buildLlmRequestTokenUsage,
  logLlmInvalidRawResponse,
  logLlmRequest,
  logLlmResponse,
  logLlmToolCalls,
} from './logging.js';
import { buildTutorLessonTools, extractInferredLessonLinkBlocks } from './lessonTools.js';
import { buildTranslatorSystemInstruction, buildAgentSystemInstruction } from './prompt.js';
import { getLanguageModel, getProviderOptions, getUserFacingFinishReasonMessage, shouldUseTemperature } from './providers.js';
import { appendStructuredCorrectionRequest, buildStructuredValidationReason, extractGeneratedTextFromError, isCorrectableLlmOutputError } from './corrections.js';
import { translationResultSchema } from './schemas.js';
import { blocksToMarkdown, toModelMessage, validateTutorResponseBlocks } from './validation.js';
import type { LlmRequestOptions, LlmRequestTokenUsage, TranslationMode, TranslationResult, TutorAgentResult, TutorMessage, TutorResponseBlock, TutorResponseValidator } from './types.js';

const firstChallengePrompt = `
Start the session.
`;

const maxAgentTurns = 6;

function mergeTutorLessonLinkBlocks(
  blocks: TutorResponseBlock[],
  inferredLinks: Array<Extract<TutorResponseBlock, { type: 'lesson_link' }>>,
): TutorResponseBlock[] {
  const seenLessonIds = new Set(
    blocks
      .filter(
        (block): block is Extract<TutorResponseBlock, { type: 'lesson_link' }> =>
          block.type === 'lesson_link',
      )
      .map((block) => block.lessonId),
  );

  return [
    ...blocks,
    ...inferredLinks.filter((link) => !seenLessonIds.has(link.lessonId)),
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
      role: 'user',
      content: [
        'INTERNAL APP CONTINUATION.',
        'The previous step already used tools and may have completed lesson operations successfully.',
        'Do not call any more tools in this step.',
        'Now re-emit the complete final TutorResponse as exactly one JSON object and nothing else.',
        'Do not use markdown fences.',
        'Use the tool results below as context.',
        '',
        JSON.stringify(
          finalizedToolResults.map((result) => ({
            output: result.output,
            toolName: result.toolName,
          })),
          null,
          2,
        ),
      ].join('\n'),
    },
  ];

  return generateText({
    abortSignal: input.abortSignal,
    maxOutputTokens: 1800,
    messages,
    model: getLanguageModel(input.llm),
    providerOptions: getProviderOptions(),
    system: input.system,
    temperature: shouldUseTemperature() ? 0.25 : undefined,
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

export async function runTutorAgentLoop(
  history: TutorMessage[],
  options: {
    lesson?: {
      description: string;
      title: string;
      tutorInstructions: string;
    } | null;
    abortSignal?: AbortSignal;
    currentTitle?: string;
    currentLessonId?: string | null;
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
  const tools = buildTutorLessonTools({
    currentLessonId: options.currentLessonId ?? null,
    onToolCall: options.onToolCall,
    profileId: options.profileId ?? null,
    userId: options.userId ?? null,
  }) as ToolSet | undefined;

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
        temperature: shouldUseTemperature() ? 0.45 : undefined,
        tools,
      });
      logLlmToolCalls({
        steps: result.steps,
        turn: turn + 1,
      });
      const toolResults = result.steps.flatMap((step) => step.toolResults);
      const effectiveResult =
        (!result.text.trim() || toolResults.length > 0)
          ? await continueTutorResponseAfterToolUse({
              abortSignal: options.abortSignal,
              llm: options.llm,
              system,
              toolResults,
            })
          : result;

      let parsedObject: unknown;
      try {
        parsedObject = parseJsonFromModelText(effectiveResult.text);
      } catch (error) {
        logLlmInvalidRawResponse({
          error,
          rawText: effectiveResult.text,
          turn: turn + 1,
        });
        throw error;
      }
      logLlmResponse(
        parsedObject,
        effectiveResult.finishReason,
        effectiveResult.usage,
        effectiveResult.providerMetadata,
        turn + 1,
      );
      options.onTokenUsage?.(
        await buildLlmRequestTokenUsage({
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
        const blocks = validateTutorResponseBlocks(parsedObject);
        if (blocks.length === 0) {
          throw new Error('The model returned no usable response blocks.');
        }
        const blocksWithInferredLinks = mergeTutorLessonLinkBlocks(
          blocks,
          extractInferredLessonLinkBlocks(toolResults),
        );
        options.validateBlocks?.(blocksWithInferredLinks);

        return {
          blocks: blocksWithInferredLinks,
          content: blocksToMarkdown(blocksWithInferredLinks),
          model: env.llmModel,
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
    temperature: shouldUseTemperature() ? 0.15 : undefined,
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
    model: env.llmModel,
    provider: env.llmProvider,
  }, null, 2));

  return {
    detectedLanguage: parsed.data.detectedLanguage,
    model: env.llmModel,
    provider: env.llmProvider,
    translatedText: parsed.data.translatedText,
  };
}

export * from './types.js';
export * from './errors.js';
