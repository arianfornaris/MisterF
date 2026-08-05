import { generateText, type ModelMessage } from 'ai';
import type { Locale } from '../i18n/index.js';
import { z } from 'zod';
import type {
  RoleplayCharacter,
  RoleplayTurn,
  StoredRoleplay,
  StoredRoleplayAttempt,
} from '../db/repository.js';
import {
  getLanguageModel,
  getProviderOptions,
  shouldUseTemperature,
} from './llmTutor/providers.js';
import {
  logLlmInvalidRawResponse,
  logLlmRequest,
  logLlmCost,
  logLlmResponse,
} from './llmTutor/logging.js';
import type { LlmRequestOptions } from './llmTutor/types.js';
import { defaultProfileModelTier } from '../profiles/modelTier.js';
import { instructionLanguageEnglishName } from './llmTutor/languagePack.js';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import { logger } from './logger.js';
import { renderSystemPrompt } from './systemPrompts.js';
import { isRoleplayCharacterAvatarId } from '../roleplays/avatarRegistry.js';

const maxRoleplayAuthoringMessages = 40;
const maxRoleplayGenerationTurns = 3;

export const roleplayLevelOptions = ['A1-A2', 'B1-B2', 'C1'] as const;

export type RoleplayLevel = (typeof roleplayLevelOptions)[number];

export function isRoleplayLevel(value: string): value is RoleplayLevel {
  return roleplayLevelOptions.some((level) => level === value);
}

const roleplayCharacterSchema = z.object({
  avatarId: z.string()
    .trim()
    .max(64)
    .refine(isRoleplayCharacterAvatarId, 'Avatar id must match a registered roleplay character avatar.')
    .optional(),
  description: z.string().trim().min(1).max(1200),
  id: z.enum(['learner', 'ai']),
  name: z.string().trim().min(1).max(120),
}).strict();

export const roleplayDraftSchema = z.object({
  characters: z.array(roleplayCharacterSchema).length(2),
  description: z.string().trim().min(1).max(5000),
  level: z.string().trim().max(120).default(''),
  title: z.string().trim().min(1).max(220),
}).strict().superRefine((draft, ctx) => {
  const characterIds = new Set<string>();
  draft.characters.forEach((character, index) => {
    if (characterIds.has(character.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Character ids must be unique.',
        path: ['characters', index, 'id'],
      });
    }
    characterIds.add(character.id);
  });

  for (const requiredId of ['learner', 'ai']) {
    if (!characterIds.has(requiredId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `characters must include ${requiredId}.`,
        path: ['characters'],
      });
    }
  }
});

export const roleplayAuthoringDraftSchema = roleplayDraftSchema.superRefine((draft, ctx) => {
  if (!isRoleplayLevel(draft.level)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Level must be one of A1-A2, B1-B2, or C1.',
      path: ['level'],
    });
  }
});

const roleplayTurnSchema = z.object({
  characterId: z.string().trim().max(64),
  createdAt: z.string().trim().default(''),
  speaker: z.enum(['ai', 'learner']),
  text: z.string().trim().min(1).max(4000),
}).strict();

const nextRoleplayTurnSchema = z.object({
  text: z.string().trim().min(1).max(1600),
}).strict();

const roleplayInlineReviewPartSchema = z.object({
  explanation: z.string().trim().max(700).optional(),
  status: z.enum(['correct', 'improve', 'error']),
  text: z.string().trim().min(1).max(600),
}).strict();

export const roleplayEvaluationResultSchema = z.object({
  difficulties: z.array(z.string().trim().min(1).max(220)).max(10).default([]),
  entries: z.array(z.object({
    feedback: z.string().trim().min(1).max(1200),
    inlineReview: z.object({
      parts: z.array(roleplayInlineReviewPartSchema).min(1).max(40),
      type: z.literal('sentence_evaluation').default('sentence_evaluation'),
    }).strict(),
    scoreLabel: z.string().trim().max(80).default(''),
    text: z.string().trim().min(1).max(4000),
    turnNumber: z.number().int().min(1).max(80),
  }).strict()).max(40),
  overallFeedback: z.string().trim().min(1).max(1600),
  recommendations: z.array(z.string().trim().min(1).max(220)).max(10).default([]),
  strengths: z.array(z.string().trim().min(1).max(220)).max(10).default([]),
  summary: z.string().trim().min(1).max(500),
  summaryTitle: z.string().trim().min(1).max(180),
  vocabulary: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
}).strict();

export type RoleplayDraft = z.infer<typeof roleplayDraftSchema>;
export type RoleplayEvaluationResult = z.infer<typeof roleplayEvaluationResultSchema>;
export type RoleplayRevisionConversationMessage = {
  content: string;
  createdAt?: string;
  draftSnapshot?: Record<string, unknown>;
  role: 'assistant' | 'user';
};

export const roleplayRevisionSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(2000),
  draft: roleplayAuthoringDraftSchema,
}).strict();

export type RoleplayRevisionResult = z.infer<typeof roleplayRevisionSchema>;

export function parseRoleplayDraft(value: unknown): RoleplayDraft {
  return roleplayDraftSchema.parse(normalizeLegacyRoleplayDraft(value));
}

export function safeParseRoleplayDraft(value: unknown): RoleplayDraft | null {
  const parsed = roleplayDraftSchema.safeParse(normalizeLegacyRoleplayDraft(value));
  return parsed.success ? parsed.data : null;
}

function normalizeLegacyRoleplayDraft(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const legacyScenario = typeof record.scenario === 'string'
    ? record.scenario.trim()
    : '';

  return {
    characters: record.characters,
    description: legacyScenario || record.description,
    level: record.level,
    title: record.title,
  };
}

export function storedRoleplayToDraft(roleplay: StoredRoleplay): RoleplayDraft {
  return roleplayDraftSchema.parse({
    characters: roleplay.characters,
    description: roleplay.description,
    level: roleplay.level,
    title: roleplay.title,
  });
}

export function createRoleplayDraftFromManualInput(input: {
  characters: RoleplayCharacter[];
  description: string;
  level: string;
  previousDraft: RoleplayDraft;
  title: string;
}): RoleplayDraft | null {
  const parsed = roleplayAuthoringDraftSchema.safeParse({
    ...input.previousDraft,
    characters: input.characters,
    description: input.description,
    level: input.level,
    title: input.title,
  });

  return parsed.success ? parsed.data : null;
}

export function normalizeRoleplayRevisionConversationHistory(
  messages: RoleplayRevisionConversationMessage[],
): RoleplayRevisionConversationMessage[] {
  const recentMessages = messages
    .flatMap((message): RoleplayRevisionConversationMessage[] => {
      const content = message.content.trim();
      if (!content || (message.role !== 'assistant' && message.role !== 'user')) {
        return [];
      }

      const draftSnapshot = safeParseRoleplayDraft(message.draftSnapshot);
      return [{
        content: content.slice(0, 4000),
        createdAt: message.createdAt?.trim() || undefined,
        draftSnapshot: draftSnapshot ?? undefined,
        role: message.role,
      }];
    })
    .slice(-24);

  let includedSnapshots = 0;
  return recentMessages
    .slice()
    .reverse()
    .map((message): RoleplayRevisionConversationMessage => {
      if (!message.draftSnapshot || includedSnapshots >= 6) {
        return {
          content: message.content,
          createdAt: message.createdAt,
          role: message.role,
        };
      }

      includedSnapshots += 1;
      return message;
    })
    .reverse();
}

export async function generateOpeningRoleplayTurn(input: {
  draft: RoleplayDraft;
  llm: LlmRequestOptions;
}): Promise<RoleplayTurn> {
  const aiCharacter = getAiCharacter(input.draft);
  const parsed = await generateStructuredRoleplayOutput({
    actorLabel: 'Roleplay opening turn',
    llm: input.llm,
    schema: nextRoleplayTurnSchema,
    systemPromptPath: 'resources/roleplay-turn.md',
    userPayload: {
      aiCharacter,
      learnerCharacter: getLearnerCharacter(input.draft),
      roleplay: input.draft,
      turns: [],
    },
  });

  return {
    characterId: aiCharacter.id,
    createdAt: new Date().toISOString(),
    speaker: 'ai',
    text: parsed.text,
  };
}

export function getLearnerCharacter(draft: RoleplayDraft): RoleplayCharacter {
  return draft.characters.find((character) => character.id === 'learner')
    ?? draft.characters[0];
}

export function getAiCharacter(draft: RoleplayDraft): RoleplayCharacter {
  return draft.characters.find((character) => character.id === 'ai')
    ?? draft.characters[1]
    ?? draft.characters[0];
}

export function countLearnerTurns(turns: RoleplayTurn[]): number {
  return turns.filter((turn) => turn.speaker === 'learner').length;
}

export async function generateNextRoleplayTurn(input: {
  attempt: StoredRoleplayAttempt;
  draft: RoleplayDraft;
  llm: LlmRequestOptions;
}): Promise<RoleplayTurn> {
  const aiCharacter = getAiCharacter(input.draft);
  const parsed = await generateStructuredRoleplayOutput({
    actorLabel: 'Roleplay turn',
    llm: input.llm,
    schema: nextRoleplayTurnSchema,
    systemPromptPath: 'resources/roleplay-turn.md',
    userPayload: {
      aiCharacter,
      learnerCharacter: getLearnerCharacter(input.draft),
      roleplay: input.draft,
      turns: input.attempt.turns,
    },
  });

  return {
    characterId: aiCharacter.id,
    createdAt: new Date().toISOString(),
    speaker: 'ai',
    text: parsed.text,
  };
}

export async function evaluateRoleplayAttempt(input: {
  attempt: StoredRoleplayAttempt;
  draft: RoleplayDraft;
  instructionLanguage?: Locale;
  llm: LlmRequestOptions;
}): Promise<RoleplayEvaluationResult> {
  return generateStructuredRoleplayOutput({
    actorLabel: 'Roleplay evaluation',
    llm: input.llm,
    schema: roleplayEvaluationResultSchema,
    systemPromptPath: 'resources/roleplay-evaluation.md',
    systemPromptVariables: {
      INSTRUCTION_LANGUAGE_NAME: instructionLanguageEnglishName(
        input.instructionLanguage ?? 'es',
      ),
    },
    userPayload: {
      roleplay: input.draft,
      turns: input.attempt.turns,
    },
  });
}

export function buildRoleplayProgressSummary(result: RoleplayEvaluationResult): string {
  return compactText(result.summary, 280);
}

export function buildRoleplayAuthoringMessage(
  role: 'assistant' | 'user',
  content: string,
  draftSnapshot?: RoleplayDraft,
): {
  content: string;
  createdAt: string;
  draftSnapshot?: RoleplayDraft;
  role: 'assistant' | 'user';
} {
  const message = {
    content: content.trim().slice(0, 6000),
    createdAt: new Date().toISOString(),
    role,
  };

  return draftSnapshot
    ? { ...message, draftSnapshot }
    : message;
}

export function appendRoleplayAuthoringMessages<T extends {
  content: string;
  createdAt?: string;
  draftSnapshot?: Record<string, unknown>;
  role: 'assistant' | 'user';
}>(
  existingMessages: T[],
  ...messages: T[]
): T[] {
  return [...existingMessages, ...messages]
    .flatMap((message): T[] => {
      const content = message.content.trim().slice(0, 6000);
      if (!content || (message.role !== 'assistant' && message.role !== 'user')) {
        return [];
      }

      return [{
        ...message,
        content,
        createdAt: message.createdAt || new Date().toISOString(),
      }];
    })
    .slice(-maxRoleplayAuthoringMessages);
}

async function generateStructuredRoleplayOutput<T>(input: {
  actorLabel: string;
  llm: LlmRequestOptions;
  schema: z.ZodType<T>;
  systemPromptPath: string;
  systemPromptVariables?: Record<string, string>;
  userPayload: Record<string, unknown>;
}): Promise<T> {
  const modelTier = input.llm.modelTier ?? defaultProfileModelTier;
  const system = renderSystemPrompt(
    input.systemPromptPath,
    input.systemPromptVariables,
  );
  const messages: ModelMessage[] = [
    {
      content: JSON.stringify(input.userPayload, null, 2),
      role: 'user',
    },
  ];

  for (let turn = 0; turn < maxRoleplayGenerationTurns; turn += 1) {
    logLlmRequest(
      messages,
      system,
      {
        actorLabel: input.actorLabel,
        llm: input.llm,
        operation: 'roleplay',
      },
      turn + 1,
    );

    const result = await generateText({
      model: getLanguageModel(input.llm),
      messages,
      providerOptions: getProviderOptions(),
      system,
      temperature: shouldUseTemperature({ modelTier }) ? 0.45 : undefined,
    });

    logLlmResponse(
      result.text,
      result.finishReason,
      result.usage,
      result.providerMetadata,
      turn + 1,
      {
        actorLabel: input.actorLabel,
        operation: 'roleplay',
      },
    );
    logLlmCost({
      context: { actorLabel: input.actorLabel, llm: input.llm, operation: 'roleplay' },
      finishReason: result.finishReason,
      providerMetadata: result.providerMetadata,
      usage: result.usage,
    });

    let parsedJson: unknown;
    try {
      parsedJson = parseJsonFromModelText(result.text);
    } catch (error) {
      logLlmInvalidRawResponse({
        actorLabel: input.actorLabel,
        error,
        operation: 'roleplay',
        rawText: result.text,
        turn: turn + 1,
      });
      if (turn < maxRoleplayGenerationTurns - 1) {
        appendRoleplayCorrectionRequest(messages, 'Your previous response was not valid JSON.', result.text);
        continue;
      }

      throw new Error('The model returned invalid roleplay JSON.');
    }

    const parsed = input.schema.safeParse(parsedJson);
    if (!parsed.success) {
      logger.warn('roleplay_structured_validation_failed', {
        actorLabel: input.actorLabel,
        issueCount: parsed.error.issues.length,
        operation: 'roleplay',
        turn: turn + 1,
      });

      if (turn < maxRoleplayGenerationTurns - 1) {
        appendRoleplayCorrectionRequest(
          messages,
          'Your previous JSON did not match the required schema.',
          result.text,
        );
        continue;
      }

      throw new Error('The model returned invalid roleplay data.');
    }

    return parsed.data;
  }

  throw new Error('Could not generate usable roleplay output.');
}

function appendRoleplayCorrectionRequest(
  messages: ModelMessage[],
  reason: string,
  invalidOutput: string,
): void {
  messages.push({
    content: invalidOutput.slice(0, 10000),
    role: 'assistant',
  });
  messages.push({
    content: [
      'INTERNAL APP CONTINUATION.',
      reason,
      'Return the corrected response as exactly one JSON object and nothing else.',
      'Do not use markdown fences.',
    ].join('\n'),
    role: 'user',
  });
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
