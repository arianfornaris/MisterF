import { generateText, type ModelMessage } from 'ai';
import type { Locale } from '../i18n/index.js';
import { z } from 'zod';
import {
  quizBlockSchema,
  quizDraftSchema,
  quizMetadataSchema,
  quizSectionSchema,
  type QuizDraft,
  type QuizMetadata,
} from './quizzes.js';
import { quizItemSchema } from './llmTutor/schemas.js';
import type { TutorQuizItem } from './llmTutor/types.js';
import {
  normalizeRoleplayRevisionConversationHistory,
  roleplayAuthoringDraftSchema,
  roleplayRevisionSchema,
  type RoleplayDraft,
  type RoleplayRevisionConversationMessage,
  type RoleplayRevisionResult,
} from './roleplays.js';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import {
  getLanguageModel,
  getProviderOptions,
  type OpenRouterReasoningEffort,
  shouldUseTemperature,
} from './llmTutor/providers.js';
import { logLlmInvalidRawResponse, logLlmRequest, logLlmResponse } from './llmTutor/logging.js';
import { logger } from './logger.js';
import { renderSystemPrompt } from './systemPrompts.js';
import {
  instructionLanguageEnglishName,
  quizAuthoringPlaceholders,
} from './llmTutor/languagePack.js';
import { buildRoleplayCharacterAvatarPromptOptions } from '../roleplays/avatarRegistry.js';

const maxDraftGenerationTurns = 4;

function languagePromptVariables(
  instructionLanguage: Locale = 'es',
): Record<string, string> {
  return {
    INSTRUCTION_LANGUAGE_NAME: instructionLanguageEnglishName(instructionLanguage),
  };
}

export const practiceGuideDraftSchema = z.object({
  description: z.string().trim().min(1).max(1500),
  title: z.string().trim().min(1).max(220),
  tutorInstructions: z.string().trim().min(1).max(12000),
}).strict();

const practiceGuideRevisionSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(2000),
  guide: practiceGuideDraftSchema,
}).strict();

const quizMetadataRevisionSchema = z.object({
  metadata: quizMetadataSchema,
}).strict();

export type QuizBlockRevisionContext = {
  instructions: string;
  level: string;
  sectionInstructions?: string;
  siblingKinds: string[];
  targetTopic: string;
  title: string;
};

export type PracticeGuideDraft = z.infer<typeof practiceGuideDraftSchema>;
export type PracticeGuideRevisionResult = z.infer<typeof practiceGuideRevisionSchema>;

function appendCorrectionRequest(messages: ModelMessage[], input: {
  actorLabel: string;
  correctionPromptPath: string;
  invalidOutput?: string | null;
  reason: string;
  systemPromptVariables?: Record<string, string>;
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
      ...(input.systemPromptVariables ?? {}),
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

function summarizeParsedJsonShape(value: unknown): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    return {
      valueType: Array.isArray(value) ? 'array' : typeof value,
    };
  }

  const blocks = Array.isArray(value.blocks) ? value.blocks : null;

  return {
    blockCount: blocks?.length,
    itemKinds: blocks?.slice(0, 32).map((block, index) => {
      const blockRecord = isPlainRecord(block) ? block : {};
      const itemRecord = isPlainRecord(blockRecord.item) ? blockRecord.item : {};
      return {
        id: typeof blockRecord.id === 'string' ? blockRecord.id : undefined,
        index,
        kind: typeof itemRecord.kind === 'string' ? itemRecord.kind : undefined,
      };
    }),
    topLevelKeys: Object.keys(value).slice(0, 24),
  };
}

function summarizeZodIssues(
  issues: z.ZodIssue[],
  maxIssues = 16,
): Array<Record<string, unknown>> {
  const summaries: Array<Record<string, unknown>> = [];

  const addIssue = (
    issue: z.ZodIssue,
    pathPrefix: PropertyKey[] = [],
  ): void => {
    if (summaries.length >= maxIssues) {
      return;
    }

    const issueRecord = issue as unknown as Record<string, unknown>;
    summaries.push({
      code: issue.code,
      expected: issueRecord.expected,
      keys: issueRecord.keys,
      message: issue.message,
      path: formatZodPath([...pathPrefix, ...issue.path]),
      values: issueRecord.values,
    });
  };

  const visitIssue = (
    issue: z.ZodIssue,
    pathPrefix: PropertyKey[] = [],
  ): void => {
    if (summaries.length >= maxIssues) {
      return;
    }

    const issueRecord = issue as unknown as Record<string, unknown>;
    const nestedErrors = issueRecord.errors;
    if (issue.code === 'invalid_union' && Array.isArray(nestedErrors)) {
      const nestedPath = [...pathPrefix, ...issue.path];
      for (const branch of nestedErrors) {
        if (!Array.isArray(branch)) {
          continue;
        }

        for (const childIssue of branch) {
          visitIssue(childIssue as z.ZodIssue, nestedPath);
          if (summaries.length >= maxIssues) {
            return;
          }
        }
      }
      return;
    }

    addIssue(issue, pathPrefix);
  };

  for (const issue of issues) {
    visitIssue(issue);
    if (summaries.length >= maxIssues) {
      break;
    }
  }

  return summaries;
}

function formatZodPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return '(root)';
  }

  return path.map((segment) => String(segment)).join('.');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function generateStructuredDraft<T>(input: {
  actorLabel: string;
  correctionPromptPath: string;
  initialUserMessage: string;
  openRouterApiKey?: string | null;
  reasoningEffort?: OpenRouterReasoningEffort;
  schema: z.ZodType<T>;
  systemPromptPath: string;
  systemPromptVariables?: Record<string, string>;
}): Promise<T> {
  const system = renderSystemPrompt(
    input.systemPromptPath,
    input.systemPromptVariables,
  );
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
      model: getLanguageModel({
        modelTier: 'regular',
        openRouterApiKey: input.openRouterApiKey,
      }),
      messages,
      providerOptions: getProviderOptions({
        reasoningEffort: input.reasoningEffort,
      }),
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

    if (result.finishReason === 'length') {
      logger.warn('resource_draft_output_truncated', {
        actorLabel: input.actorLabel,
        operation: 'resource_draft',
        turn: turn + 1,
      });
      if (turn < maxDraftGenerationTurns - 1) {
        appendCorrectionRequest(messages, {
          actorLabel: input.actorLabel,
          correctionPromptPath: input.correctionPromptPath,
          reason:
            'Your previous response exceeded the output budget. Return a complete, more concise JSON object and keep every required field.',
          systemPromptVariables: input.systemPromptVariables,
          turn: turn + 1,
        });
        continue;
      }

      throw new Error('La IA devolvió un borrador truncado.');
    }

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
          systemPromptVariables: input.systemPromptVariables,
          turn: turn + 1,
        });
        continue;
      }

      throw new Error('La IA devolvió un borrador inválido.');
    }

    const parsed = input.schema.safeParse(parsedJson);
    if (!parsed.success) {
      logger.warn('resource_draft_validation_failed', {
        actorLabel: input.actorLabel,
        issueCount: parsed.error.issues.length,
        issues: summarizeZodIssues(parsed.error.issues),
        operation: 'resource_draft',
        parsedShape: summarizeParsedJsonShape(parsedJson),
        turn: turn + 1,
      });

      if (turn < maxDraftGenerationTurns - 1) {
        appendCorrectionRequest(messages, {
          actorLabel: input.actorLabel,
          correctionPromptPath: input.correctionPromptPath,
          invalidOutput: result.text,
          reason: 'Your previous JSON did not match the required schema.',
          systemPromptVariables: input.systemPromptVariables,
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

export async function generatePracticeGuideDraft(input: {
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<PracticeGuideDraft> {
  return generateStructuredDraft({
    actorLabel: 'Practice guide draft',
    correctionPromptPath: 'resources/practice-guide-draft-correction.md',
    initialUserMessage: input.prompt,
    openRouterApiKey: input.openRouterApiKey,
    schema: practiceGuideDraftSchema,
    systemPromptPath: 'resources/practice-guide-draft.md',
    systemPromptVariables: languagePromptVariables(input.instructionLanguage),
  });
}

export async function generatePracticeGuideRevision(input: {
  currentPracticeGuide: PracticeGuideDraft;
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<PracticeGuideRevisionResult> {
  return generateStructuredDraft({
    actorLabel: 'Practice guide revision',
    correctionPromptPath: 'resources/practice-guide-revision-correction.md',
    initialUserMessage: JSON.stringify(
      {
        currentPracticeGuide: input.currentPracticeGuide,
        requestedChange: input.prompt,
      },
      null,
      2,
    ),
    openRouterApiKey: input.openRouterApiKey,
    schema: practiceGuideRevisionSchema,
    systemPromptPath: 'resources/practice-guide-revision.md',
    systemPromptVariables: languagePromptVariables(input.instructionLanguage),
  });
}

export function safeParsePracticeGuideDraft(value: unknown): PracticeGuideDraft | null {
  const parsed = practiceGuideDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function generateQuizDraft(input: {
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<QuizDraft> {
  return generateStructuredDraft({
    actorLabel: 'Quiz draft',
    correctionPromptPath: 'resources/quiz-draft-correction.md',
    initialUserMessage: input.prompt,
    openRouterApiKey: input.openRouterApiKey,
    schema: quizDraftSchema,
    systemPromptPath: 'resources/quiz-draft.md',
    systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
  });
}

const quizResponsesSummarySchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
  })
  .strict();

export async function generateQuizResponsesSummary(input: {
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  request: {
    evaluatedCount: number;
    questions: Array<{
      correct: number;
      incorrect: number;
      partial: number;
      prompt: string;
    }>;
    respondedCount: number;
    targetTopic: string;
    title: string;
  };
}): Promise<{ summary: string }> {
  return generateStructuredDraft({
    actorLabel: 'Quiz responses summary',
    correctionPromptPath: 'resources/quiz-responses-summary-correction.md',
    initialUserMessage: JSON.stringify(input.request, null, 2),
    openRouterApiKey: input.openRouterApiKey,
    schema: quizResponsesSummarySchema,
    systemPromptPath: 'resources/quiz-responses-summary.md',
    systemPromptVariables: languagePromptVariables(input.instructionLanguage ?? 'es'),
  });
}

export async function generateQuizMetadataRevision(input: {
  currentMetadata: QuizMetadata;
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<{ metadata: QuizMetadata }> {
  return generateStructuredDraft({
    actorLabel: 'Quiz metadata revision',
    correctionPromptPath: 'resources/quiz-metadata-revision-correction.md',
    initialUserMessage: JSON.stringify(
      {
        currentMetadata: input.currentMetadata,
        requestedChange: input.prompt,
      },
      null,
      2,
    ),
    openRouterApiKey: input.openRouterApiKey,
    schema: quizMetadataRevisionSchema,
    systemPromptPath: 'resources/quiz-metadata-revision.md',
    systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
  });
}

/**
 * Revises a quiz's blocks and sections in one call while preserving its
 * metadata (title/description/topic/level/instructions). The model returns only
 * `{ blocks, sections }`; the current metadata is injected before validation so
 * the `Bloques`-tab operation can never rewrite the general details. The result
 * is a fully validated draft (unique ids, section cross-references).
 */
export async function generateQuizBlocksRevision(input: {
  currentMetadata: QuizMetadata;
  currentDraft: QuizDraft;
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<{ blocks: QuizDraft['blocks']; sections: QuizDraft['sections'] }> {
  // Validate the model's blocks/sections against the full draft schema (unique
  // ids, section cross-references) by assembling them with the current metadata,
  // so cross-cutting errors are caught inside the generation correction loop.
  const blocksRevisionSchema = z
    .object({
      blocks: z.array(quizBlockSchema).min(1),
      sections: z.array(quizSectionSchema).default([]),
    })
    .superRefine((value, ctx) => {
      const assembled = quizDraftSchema.safeParse({
        ...input.currentMetadata,
        blocks: value.blocks,
        sections: value.sections,
      });
      if (!assembled.success) {
        for (const issue of assembled.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: issue.path,
          });
        }
      }
    });

  return generateStructuredDraft({
    actorLabel: 'Quiz blocks revision',
    correctionPromptPath: 'resources/quiz-blocks-revision-correction.md',
    initialUserMessage: JSON.stringify(
      {
        currentBlocks: input.currentDraft.blocks,
        currentSections: input.currentDraft.sections,
        metadataContext: input.currentMetadata,
        requestedChange: input.prompt,
      },
      null,
      2,
    ),
    openRouterApiKey: input.openRouterApiKey,
    schema: blocksRevisionSchema,
    systemPromptPath: 'resources/quiz-blocks-revision.md',
    systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
  });
}

/**
 * Generates a single quiz item, scoped so it can never touch other blocks.
 * When `currentItem` is provided the model revises it (the per-block modify
 * operation); when it is omitted the model creates a new item of `targetKind`
 * from the request (the add-block operation). Either way the returned
 * `item.kind` is enforced to equal `targetKind`.
 */
export async function generateQuizBlockRevision(input: {
  currentItem?: TutorQuizItem;
  instructionLanguage?: Locale;
  level: string;
  openRouterApiKey?: string | null;
  prompt: string;
  quizContext: QuizBlockRevisionContext;
  targetKind: string;
}): Promise<{ item: TutorQuizItem }> {
  const blockRevisionSchema = z
    .object({
      item: quizItemSchema.refine((item) => item.kind === input.targetKind, {
        message: `item.kind must be "${input.targetKind}".`,
      }),
    })
    .strict();

  return generateStructuredDraft({
    actorLabel: input.currentItem ? 'Quiz block revision' : 'Quiz block creation',
    correctionPromptPath: 'resources/quiz-block-revision-correction.md',
    initialUserMessage: JSON.stringify(
      {
        ...(input.currentItem ? { currentItem: input.currentItem } : {}),
        level: input.level,
        quizContext: input.quizContext,
        requestedChange: input.prompt,
        requestedKind: input.targetKind,
      },
      null,
      2,
    ),
    openRouterApiKey: input.openRouterApiKey,
    schema: blockRevisionSchema,
    systemPromptPath: 'resources/quiz-block-revision.md',
    systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
  });
}

export async function generateRoleplayDraft(input: {
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<RoleplayDraft> {
  const roleplayAvatarOptions = buildRoleplayCharacterAvatarPromptOptions();
  return generateStructuredDraft({
    actorLabel: 'Roleplay draft',
    correctionPromptPath: 'resources/roleplay-draft-correction.md',
    initialUserMessage: input.prompt,
    openRouterApiKey: input.openRouterApiKey,
    schema: roleplayAuthoringDraftSchema,
    systemPromptPath: 'resources/roleplay-draft.md',
    systemPromptVariables: {
      ...languagePromptVariables(input.instructionLanguage),
      ROLEPLAY_AVATAR_OPTIONS: roleplayAvatarOptions,
    },
  });
}

export async function generateRoleplayRevision(input: {
  conversationHistory?: RoleplayRevisionConversationMessage[];
  currentDraft: RoleplayDraft;
  instructionLanguage?: Locale;
  openRouterApiKey?: string | null;
  prompt: string;
}): Promise<RoleplayRevisionResult> {
  const roleplayAvatarOptions = buildRoleplayCharacterAvatarPromptOptions();
  return generateStructuredDraft({
    actorLabel: 'Roleplay revision',
    correctionPromptPath: 'resources/roleplay-revision-correction.md',
    initialUserMessage: JSON.stringify(
      {
        conversationHistory: normalizeRoleplayRevisionConversationHistory(
          input.conversationHistory ?? [],
        ),
        currentDraft: input.currentDraft,
        requestedChange: input.prompt,
      },
      null,
      2,
    ),
    openRouterApiKey: input.openRouterApiKey,
    reasoningEffort: 'minimal',
    schema: roleplayRevisionSchema,
    systemPromptPath: 'resources/roleplay-revision.md',
    systemPromptVariables: {
      ...languagePromptVariables(input.instructionLanguage),
      ROLEPLAY_AVATAR_OPTIONS: roleplayAvatarOptions,
    },
  });
}
