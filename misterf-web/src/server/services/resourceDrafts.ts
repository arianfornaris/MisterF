import { generateText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { getLanguageModel, getProviderOptions, shouldUseTemperature } from './llmTutor/providers.js';
import { logLlmInvalidRawResponse, logLlmRequest, logLlmResponse } from './llmTutor/logging.js';
import { logger } from './logger.js';
import { renderSystemPrompt } from './systemPrompts.js';

const maxDraftGenerationTurns = 4;

const practiceModuleDraftSchema = z.object({
  description: z.string().trim().min(1).max(1500),
  title: z.string().trim().min(1).max(220),
  tutorInstructions: z.string().trim().min(1).max(12000),
}).strict();

const chatRoomDraftSchema = z.object({
  characters: z.array(
    z.object({
      fullDescription: z.string().trim().min(1).max(4000),
      name: z.string().trim().min(1).max(120),
      shortDescription: z.string().trim().max(160).optional().default(''),
    }).strict(),
  ).min(1).max(3),
  description: z.string().trim().min(1).max(1500),
  title: z.string().trim().min(1).max(220),
}).strict();

type PracticeModuleDraft = z.infer<typeof practiceModuleDraftSchema>;
type ChatRoomDraft = z.infer<typeof chatRoomDraftSchema>;

function parseJsonFromModelText(text: string): unknown {
  return JSON.parse(text.trim()) as unknown;
}

function appendCorrectionRequest(messages: ModelMessage[], input: {
  actorLabel: string;
  correctionPromptPath: string;
  invalidOutput?: string | null;
  reason: string;
  turn: number;
}): void {
  const invalidOutput = input.invalidOutput?.trim();
  if (invalidOutput) {
    messages.push({
      content: invalidOutput.slice(0, 10000),
      role: 'assistant',
    });
  }

  messages.push({
    content: renderSystemPrompt(input.correctionPromptPath, {
      CORRECTION_REASON: input.reason,
    }),
    role: 'user',
  });

  logger.info('resource_draft_structured_correction', {
    actorLabel: input.actorLabel,
    hadInvalidOutput: Boolean(invalidOutput),
    reason: input.reason,
    turn: input.turn,
  });
}

async function generateStructuredDraft<T>(input: {
  actorLabel: string;
  correctionPromptPath: string;
  initialUserMessage: string;
  openRouterApiKey?: string | null;
  schema: z.ZodType<T>;
  systemPromptPath: string;
}): Promise<T> {
  const system = renderSystemPrompt(input.systemPromptPath);
  const messages: ModelMessage[] = [
    {
      content: input.initialUserMessage,
      role: 'user',
    },
  ];

  for (let turn = 0; turn < maxDraftGenerationTurns; turn += 1) {
    logLlmRequest(
      messages,
      system,
      {
        actorLabel: input.actorLabel,
        llm: {
          modelTier: 'regular',
          openRouterApiKey: input.openRouterApiKey,
        },
        operation: 'resource_draft',
      },
      turn + 1,
    );

    const result = await generateText({
      maxOutputTokens: 1800,
      model: getLanguageModel({
        modelTier: 'regular',
        openRouterApiKey: input.openRouterApiKey,
      }),
      messages,
      providerOptions: getProviderOptions(),
      system,
      temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.45 : undefined,
    });

    logLlmResponse(
      result.text,
      result.finishReason,
      result.usage,
      result.providerMetadata,
      turn + 1,
      {
        actorLabel: input.actorLabel,
        operation: 'resource_draft',
      },
    );

    let parsedJson: unknown;
    try {
      parsedJson = parseJsonFromModelText(result.text);
    } catch (error) {
      logLlmInvalidRawResponse({
        actorLabel: input.actorLabel,
        error,
        operation: 'resource_draft',
        rawText: result.text,
        turn: turn + 1,
      });
      if (turn < maxDraftGenerationTurns - 1) {
        appendCorrectionRequest(messages, {
          actorLabel: input.actorLabel,
          correctionPromptPath: input.correctionPromptPath,
          invalidOutput: result.text,
          reason: 'Your previous response was not valid JSON.',
          turn: turn + 1,
        });
        continue;
      }

      throw new Error('La IA devolvió un borrador inválido.');
    }

    const parsed = input.schema.safeParse(parsedJson);
    if (!parsed.success) {
      if (turn < maxDraftGenerationTurns - 1) {
        appendCorrectionRequest(messages, {
          actorLabel: input.actorLabel,
          correctionPromptPath: input.correctionPromptPath,
          invalidOutput: result.text,
          reason: 'Your previous JSON did not match the required schema.',
          turn: turn + 1,
        });
        continue;
      }

      throw new Error('La IA devolvió un borrador incompleto.');
    }

    return parsed.data;
  }

  throw new Error('No pude generar un borrador usable.');
}

export async function generatePracticeModuleDraft(input: {
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<PracticeModuleDraft> {
  return generateStructuredDraft({
    actorLabel: 'Practice module draft',
    correctionPromptPath: 'resources/practice-module-draft-correction.md',
    initialUserMessage: input.prompt,
    openRouterApiKey: input.openRouterApiKey,
    schema: practiceModuleDraftSchema,
    systemPromptPath: 'resources/practice-module-draft.md',
  });
}

export async function generateChatRoomDraft(input: {
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<ChatRoomDraft> {
  return generateStructuredDraft({
    actorLabel: 'Chatroom draft',
    correctionPromptPath: 'resources/chatroom-draft-correction.md',
    initialUserMessage: input.prompt,
    openRouterApiKey: input.openRouterApiKey,
    schema: chatRoomDraftSchema,
    systemPromptPath: 'resources/chatroom-draft.md',
  });
}
