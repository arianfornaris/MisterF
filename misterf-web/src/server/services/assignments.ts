import { z } from 'zod';
import type {
  TutorQuizBlock,
  TutorQuizItem,
  TutorQuizResultBlock,
} from './llmTutor/types.js';
import {
  quizBlockSchema,
  quizItemSchema,
  quizResultBlockSchema,
} from './llmTutor/schemas.js';
import { evaluateQuizResultItemsWithLlm } from './llmTutor/index.js';
import type { LlmRequestOptions } from './llmTutor/types.js';
import type {
  StoredAssignment,
  StoredAssignmentAttempt,
} from '../db/repository.js';

const maxAssignmentBlocks = 24;

export const assignmentBlockSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[a-z][a-z0-9_-]*$/),
    item: quizItemSchema,
  })
  .strict();

export const assignmentDraftSchema = z
  .object({
    blocks: z.array(assignmentBlockSchema).min(1).max(maxAssignmentBlocks),
    description: z.string().trim().max(1500).default(''),
    estimatedMinutes: z.number().int().min(1).max(180).nullable().default(null),
    instructions: z.string().trim().max(3000).default(''),
    level: z.string().trim().max(120).default(''),
    rubric: z.string().trim().max(3000).default(''),
    targetTopic: z.string().trim().max(220).default(''),
    title: z.string().trim().min(1).max(220),
  })
  .strict()
  .superRefine((draft, ctx) => {
    const seenIds = new Set<string>();

    draft.blocks.forEach((block, index) => {
      const normalizedId = block.id.toLowerCase();
      if (seenIds.has(normalizedId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Block ids must be unique within an assignment draft.',
          path: ['blocks', index, 'id'],
        });
      }

      seenIds.add(normalizedId);
    });
  });

export type AssignmentBlock = z.infer<typeof assignmentBlockSchema>;
export type AssignmentDraft = z.infer<typeof assignmentDraftSchema>;

export type AssignmentEvaluationSummary = {
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  totalCount: number;
};

export type AssignmentStudentQuizItem =
  | {
      kind: 'quiz_open_text';
      placeholder?: string;
      prompt: string;
    }
  | {
      kind: 'quiz_translate_to_english' | 'quiz_understand_in_spanish';
      prompt: string;
      sentence: string;
    }
  | {
      blanks: Array<Record<string, never>>;
      kind: 'quiz_fill_in_the_blank_input';
      prompt: string;
      sentence: string;
    }
  | {
      blanks: Array<{
        choices: string[];
      }>;
      kind: 'quiz_fill_in_the_blank_choice';
      prompt: string;
      sentence: string;
    }
  | {
      kind: 'quiz_multiple_choice';
      options: string[];
      prompt: string;
      selectionMode: 'single' | 'multiple';
    }
  | {
      kind: 'quiz_matching_pairs';
      leftItems: string[];
      prompt: string;
      rightItems: string[];
    }
  | {
      kind: 'quiz_unscramble_sentence';
      prompt: string;
      tokens: string[];
    };

export type AssignmentStudentQuizBlock = {
  items: AssignmentStudentQuizItem[];
  prompt: string;
  title: string;
  type: 'quiz';
};

export function parseAssignmentDraft(value: unknown): AssignmentDraft {
  return assignmentDraftSchema.parse(value);
}

export function safeParseAssignmentDraft(value: unknown): AssignmentDraft | null {
  const parsed = assignmentDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function storedAssignmentToDraft(assignment: StoredAssignment): AssignmentDraft {
  const parsed = safeParseAssignmentDraft(assignment.quiz);
  if (parsed) {
    return parsed;
  }

  return {
    blocks: [],
    description: assignment.description,
    estimatedMinutes: assignment.estimatedMinutes,
    instructions: assignment.instructions,
    level: assignment.level,
    rubric: assignment.rubric,
    targetTopic: assignment.targetTopic,
    title: assignment.title,
  };
}

export function assignmentDraftToQuizBlock(draft: AssignmentDraft): TutorQuizBlock {
  const quiz = {
    items: draft.blocks.map((block) => block.item),
    prompt: draft.instructions || draft.description || draft.title,
    ...(draft.rubric ? { rubric: draft.rubric } : {}),
    title: draft.title,
    type: 'quiz' as const,
  };

  return quizBlockSchema.parse(quiz);
}

export function assignmentDraftToStudentQuizBlock(draft: AssignmentDraft): AssignmentStudentQuizBlock {
  return {
    items: draft.blocks.map((block) => buildStudentQuizItem(block.item)),
    prompt: draft.instructions || draft.description || draft.title,
    title: draft.title,
    type: 'quiz',
  };
}

function buildStudentQuizItem(item: TutorQuizItem): AssignmentStudentQuizItem {
  if (item.kind === 'quiz_open_text') {
    return {
      kind: item.kind,
      ...(item.placeholder ? { placeholder: item.placeholder } : {}),
      prompt: item.prompt,
    };
  }

  if (item.kind === 'quiz_translate_to_english' || item.kind === 'quiz_understand_in_spanish') {
    return {
      kind: item.kind,
      prompt: item.prompt,
      sentence: item.sentence,
    };
  }

  if (item.kind === 'quiz_fill_in_the_blank_input') {
    return {
      blanks: item.blanks.map(() => ({})),
      kind: item.kind,
      prompt: item.prompt,
      sentence: item.sentence,
    };
  }

  if (item.kind === 'quiz_fill_in_the_blank_choice') {
    return {
      blanks: item.blanks.map((blank) => ({
        choices: blank.choices,
      })),
      kind: item.kind,
      prompt: item.prompt,
      sentence: item.sentence,
    };
  }

  if (item.kind === 'quiz_multiple_choice') {
    return {
      kind: item.kind,
      options: item.options,
      prompt: item.prompt,
      selectionMode: item.selectionMode,
    };
  }

  if (item.kind === 'quiz_matching_pairs') {
    return {
      kind: item.kind,
      leftItems: item.leftItems,
      prompt: item.prompt,
      rightItems: item.rightItems,
    };
  }

  return {
    kind: item.kind,
    prompt: item.prompt,
    tokens: item.tokens,
  };
}

export function createAssignmentDraftFromManualInput(input: {
  description: string;
  estimatedMinutes: number | null;
  instructions: string;
  level: string;
  previousDraft: AssignmentDraft;
  rubric: string;
  targetTopic: string;
  title: string;
}): AssignmentDraft {
  return assignmentDraftSchema.parse({
    ...input.previousDraft,
    description: input.description,
    estimatedMinutes: input.estimatedMinutes,
    instructions: input.instructions,
    level: input.level,
    rubric: input.rubric,
    targetTopic: input.targetTopic,
    title: input.title,
  });
}

export function appendAssignmentBlock(
  draft: AssignmentDraft,
  block: AssignmentBlock,
): AssignmentDraft {
  return assignmentDraftSchema.parse({
    ...draft,
    blocks: [
      ...draft.blocks,
      {
        ...block,
        id: ensureUniqueBlockId(block.id, draft.blocks),
      },
    ],
  });
}

export function removeAssignmentBlock(
  draft: AssignmentDraft,
  blockId: string,
): AssignmentDraft {
  return assignmentDraftSchema.parse({
    ...draft,
    blocks: draft.blocks.filter((block) => block.id !== blockId),
  });
}

export function duplicateAssignmentBlock(
  draft: AssignmentDraft,
  blockId: string,
): AssignmentDraft {
  const sourceBlock = draft.blocks.find((block) => block.id === blockId);
  if (!sourceBlock) {
    return draft;
  }

  const duplicatedBlock = {
    ...sourceBlock,
    id: ensureUniqueBlockId(`${sourceBlock.id}_copy`, draft.blocks),
  };
  const sourceIndex = draft.blocks.findIndex((block) => block.id === blockId);
  const blocks = draft.blocks.slice();
  blocks.splice(sourceIndex + 1, 0, duplicatedBlock);

  return assignmentDraftSchema.parse({
    ...draft,
    blocks,
  });
}

export function moveAssignmentBlock(
  draft: AssignmentDraft,
  blockId: string,
  direction: 'down' | 'up',
): AssignmentDraft {
  const currentIndex = draft.blocks.findIndex((block) => block.id === blockId);
  if (currentIndex < 0) {
    return draft;
  }

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= draft.blocks.length) {
    return draft;
  }

  const blocks = draft.blocks.slice();
  const [block] = blocks.splice(currentIndex, 1);
  if (!block) {
    return draft;
  }

  blocks.splice(nextIndex, 0, block);
  return assignmentDraftSchema.parse({
    ...draft,
    blocks,
  });
}

export function normalizeAssignmentResponses(input: {
  body: Record<string, unknown>;
  draft: AssignmentDraft;
}): Array<Record<string, unknown>> {
  return input.draft.blocks.map((block, index) => {
    const item = block.item;
    const fieldPrefix = `response_${index}`;

    if (
      item.kind === 'quiz_open_text' ||
      item.kind === 'quiz_translate_to_english' ||
      item.kind === 'quiz_understand_in_spanish'
    ) {
      return {
        text: readFormString(input.body[`${fieldPrefix}_text`], 2400),
      };
    }

    if (
      item.kind === 'quiz_fill_in_the_blank_input' ||
      item.kind === 'quiz_fill_in_the_blank_choice'
    ) {
      const values = item.blanks.map((_blank, blankIndex) =>
        readFormString(input.body[`${fieldPrefix}_blank_${blankIndex}`], 240),
      );
      const placeholderToken =
        item.kind === 'quiz_fill_in_the_blank_choice' ? '{{blank}}' : '___';

      return {
        completedSentence: fillSentencePlaceholders(
          item.sentence,
          values,
          placeholderToken,
        ),
        values,
      };
    }

    if (item.kind === 'quiz_multiple_choice') {
      const selectedOptions = readFormStringArray(
        input.body[`${fieldPrefix}_selectedOptions`],
        400,
      ).filter((option) => item.options.includes(option));

      return { selectedOptions };
    }

    if (item.kind === 'quiz_matching_pairs') {
      return {
        pairs: item.leftItems
          .map((left, pairIndex) => ({
            left,
            right: readFormString(input.body[`${fieldPrefix}_pair_${pairIndex}`], 600),
          }))
          .filter((pair) => pair.right),
      };
    }

    const sentence = readFormString(input.body[`${fieldPrefix}_sentence`], 1600);
    return {
      selectedTokens: sentence
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .slice(0, 32),
      sentence,
    };
  });
}

export async function evaluateAssignmentAttempt(input: {
  attempt: StoredAssignmentAttempt;
  llm?: LlmRequestOptions;
}): Promise<TutorQuizResultBlock> {
  const draft = parseAssignmentDraft(input.attempt.snapshot);
  const quiz = assignmentDraftToQuizBlock(draft);
  const responses = normalizeStoredResponses(input.attempt.responses);
  const evaluations = await evaluateQuizResultItemsWithLlm({
    llm: input.llm,
    quiz,
    responses,
  });

  return quizResultBlockSchema.parse(
    buildAssignmentResultBlock({
      draft,
      evaluations,
      responses,
    }),
  );
}

export function buildAssignmentEvaluationSummary(
  result: TutorQuizResultBlock,
): AssignmentEvaluationSummary {
  const summary: AssignmentEvaluationSummary = {
    correctCount: 0,
    incorrectCount: 0,
    partialCount: 0,
    totalCount: result.items.length,
  };

  for (const item of result.items) {
    if (item.evaluation.status === 'correct') {
      summary.correctCount += 1;
    } else if (item.evaluation.status === 'partial') {
      summary.partialCount += 1;
    } else {
      summary.incorrectCount += 1;
    }
  }

  return summary;
}

export function buildAssignmentResultTitle(result: TutorQuizResultBlock): string {
  const summary = buildAssignmentEvaluationSummary(result);
  return `${summary.correctCount}/${summary.totalCount} respuestas correctas`;
}

export function buildAssignmentResultBlock(input: {
  draft: AssignmentDraft;
  evaluations: Array<{
    feedback: string;
    inlineReview?: Record<string, unknown>;
    status: 'correct' | 'incorrect' | 'partial';
  }>;
  responses: Array<Record<string, unknown>>;
}): TutorQuizResultBlock {
  return {
    items: input.draft.blocks.map((block, index) =>
      buildAssignmentResultItem({
        evaluation: input.evaluations[index] ?? {
          feedback: 'Miremos esta respuesta con más detalle en la siguiente práctica.',
          status: 'partial' as const,
        },
        item: block.item,
        response: input.responses[index] ?? {},
      }),
    ),
    prompt: input.draft.instructions || input.draft.description || input.draft.title,
    title: input.draft.title,
    type: 'quiz_result',
  };
}

function buildAssignmentResultItem(input: {
  evaluation: {
    feedback: string;
    inlineReview?: Record<string, unknown>;
    status: 'correct' | 'incorrect' | 'partial';
  };
  item: TutorQuizItem;
  response: Record<string, unknown>;
}): TutorQuizResultBlock['items'][number] {
  const { evaluation, item, response } = input;
  const resultEvaluation = {
    feedback: evaluation.feedback,
    status: evaluation.status,
  };

  if (item.kind === 'quiz_open_text') {
    return {
      evaluation: resultEvaluation,
      inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
      kind: item.kind,
      prompt: item.prompt,
      userResponse: {
        text: readStoredString(response.text, 2400),
      },
    };
  }

  if (item.kind === 'quiz_translate_to_english' || item.kind === 'quiz_understand_in_spanish') {
    return {
      evaluation: resultEvaluation,
      inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
      kind: item.kind,
      prompt: item.prompt,
      sentence: item.sentence,
      userResponse: {
        text: readStoredString(response.text, 2400),
      },
    };
  }

  if (item.kind === 'quiz_fill_in_the_blank_input') {
    return {
      evaluation: resultEvaluation,
      inlineReview: normalizeBlankInlineReview(evaluation.inlineReview, item.blanks.length),
      kind: item.kind,
      prompt: item.prompt,
      sentence: item.sentence,
      userResponse: {
        completedSentence: readStoredOptionalString(response.completedSentence, 1600),
        values: readStoredStringArray(response.values, 240).slice(0, item.blanks.length),
      },
    };
  }

  if (item.kind === 'quiz_fill_in_the_blank_choice') {
    return {
      blanks: item.blanks.map((blank) => ({
        choices: blank.choices,
      })),
      evaluation: resultEvaluation,
      inlineReview: normalizeBlankInlineReview(evaluation.inlineReview, item.blanks.length),
      kind: item.kind,
      prompt: item.prompt,
      sentence: item.sentence,
      userResponse: {
        completedSentence: readStoredOptionalString(response.completedSentence, 1600),
        values: readStoredStringArray(response.values, 240).slice(0, item.blanks.length),
      },
    };
  }

  if (item.kind === 'quiz_multiple_choice') {
    return {
      evaluation: resultEvaluation,
      inlineReview: normalizeMultipleChoiceInlineReview(evaluation.inlineReview, item.options),
      kind: item.kind,
      options: item.options,
      prompt: item.prompt,
      selectionMode: item.selectionMode,
      userResponse: {
        selectedOptions: readStoredStringArray(response.selectedOptions, 400)
          .filter((option) => item.options.includes(option))
          .slice(0, item.options.length),
      },
    };
  }

  if (item.kind === 'quiz_matching_pairs') {
    const pairs = readStoredPairs(response.pairs);
    return {
      evaluation: resultEvaluation,
      inlineReview: normalizeMatchingPairsInlineReview(evaluation.inlineReview, pairs),
      kind: item.kind,
      leftItems: item.leftItems,
      prompt: item.prompt,
      rightItems: item.rightItems,
      userResponse: {
        pairs,
      },
    };
  }

  return {
    evaluation: resultEvaluation,
    inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
    kind: item.kind,
    prompt: item.prompt,
    tokens: item.tokens,
    userResponse: {
      selectedTokens: readStoredStringArray(response.selectedTokens, 120).slice(0, 32),
      sentence: readStoredOptionalString(response.sentence, 1600),
    },
  };
}

function normalizeStoredResponses(values: unknown[]): Array<Record<string, unknown>> {
  return values.map((value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
  );
}

function ensureUniqueBlockId(id: string, blocks: AssignmentBlock[]): string {
  const usedIds = new Set(blocks.map((block) => block.id));
  const baseId = id
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '') || 'block';
  let nextId = baseId.slice(0, 56);
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${baseId.slice(0, 50)}_${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function fillSentencePlaceholders(
  sentence: string,
  values: string[],
  placeholderToken: string,
): string {
  let completedSentence = sentence;
  for (const value of values) {
    completedSentence = completedSentence.replace(placeholderToken, value.trim());
  }

  return completedSentence.replace(/\s+/g, ' ').trim();
}

function readFormString(value: unknown, maxLength: number): string {
  if (Array.isArray(value)) {
    return readFormString(value[0], maxLength);
  }

  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function readFormStringArray(value: unknown, maxLength: number): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of values) {
    const normalized = readFormString(item, maxLength);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function readStoredString(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function readStoredOptionalString(value: unknown, maxLength: number): string | undefined {
  const normalized = readStoredString(value, maxLength);
  return normalized || undefined;
}

function readStoredStringArray(value: unknown, maxLength: number): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => readStoredString(item, maxLength))
        .filter(Boolean)
    : [];
}

function readStoredPairs(value: unknown): Array<{ left: string; right: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((pair) => {
      if (!pair || typeof pair !== 'object') {
        return null;
      }

      const record = pair as Record<string, unknown>;
      const left = readStoredString(record.left, 600);
      const right = readStoredString(record.right, 600);
      return left && right ? { left, right } : null;
    })
    .filter((pair): pair is { left: string; right: string } => Boolean(pair));
}

function normalizeTextInlineReview(
  value: Record<string, unknown> | undefined,
): { parts: Array<{ explanation?: string; status: 'correct' | 'improve' | 'error'; text: string }> } | undefined {
  const parts = Array.isArray(value?.parts)
    ? value.parts
        .filter(
          (part): part is { explanation?: string; status: 'correct' | 'improve' | 'error'; text: string } =>
            Boolean(
              part &&
                typeof part === 'object' &&
                typeof part.text === 'string' &&
                (part.status === 'correct' || part.status === 'improve' || part.status === 'error'),
            ),
        )
        .map((part) => ({
          explanation:
            typeof part.explanation === 'string'
              ? part.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
          status: part.status,
          text: part.text.replace(/\s+/g, ' ').trim().slice(0, 2400),
        }))
        .filter((part) => part.text)
    : [];

  return parts.length > 0 ? { parts } : undefined;
}

function normalizeBlankInlineReview(
  value: Record<string, unknown> | undefined,
  expectedLength: number,
): { blanks: Array<{ explanation?: string; status: 'correct' | 'improve' | 'error' }> } | undefined {
  const blanks = Array.isArray(value?.blanks)
    ? value.blanks
        .slice(0, expectedLength)
        .filter(
          (blank): blank is { explanation?: string; status: 'correct' | 'improve' | 'error' } =>
            Boolean(
              blank &&
                typeof blank === 'object' &&
                (blank.status === 'correct' || blank.status === 'improve' || blank.status === 'error'),
            ),
        )
        .map((blank) => ({
          explanation:
            typeof blank.explanation === 'string'
              ? blank.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
          status: blank.status,
        }))
    : [];

  return blanks.length > 0 ? { blanks } : undefined;
}

function normalizeMultipleChoiceInlineReview(
  value: Record<string, unknown> | undefined,
  options: string[],
): {
  options: Array<{
    explanation?: string;
    selectedByUser: boolean;
    status: 'correct' | 'neutral' | 'missed' | 'error';
    text: string;
  }>;
} | undefined {
  const reviews = Array.isArray(value?.options)
    ? value.options
        .filter(
          (
            option,
          ): option is {
            explanation?: string;
            selectedByUser: boolean;
            status: 'correct' | 'neutral' | 'missed' | 'error';
            text: string;
          } =>
            Boolean(
              option &&
                typeof option === 'object' &&
                typeof option.text === 'string' &&
                typeof option.selectedByUser === 'boolean' &&
                (option.status === 'correct' ||
                  option.status === 'neutral' ||
                  option.status === 'missed' ||
                  option.status === 'error'),
            ),
        )
        .filter((option) => options.includes(option.text))
        .map((option) => ({
          explanation:
            typeof option.explanation === 'string'
              ? option.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
          selectedByUser: option.selectedByUser,
          status: option.status,
          text: option.text,
        }))
    : [];

  return reviews.length > 0 ? { options: reviews } : undefined;
}

function normalizeMatchingPairsInlineReview(
  value: Record<string, unknown> | undefined,
  pairs: Array<{ left: string; right: string }>,
): {
  pairs: Array<{
    explanation?: string;
    left: string;
    right: string;
    status: 'correct' | 'error';
  }>;
} | undefined {
  const expectedPairs = new Set(pairs.map((pair) => `${pair.left}\u0000${pair.right}`));
  const reviews = Array.isArray(value?.pairs)
    ? value.pairs
        .filter(
          (
            pair,
          ): pair is {
            explanation?: string;
            left: string;
            right: string;
            status: 'correct' | 'error';
          } =>
            Boolean(
              pair &&
                typeof pair === 'object' &&
                typeof pair.left === 'string' &&
                typeof pair.right === 'string' &&
                (pair.status === 'correct' || pair.status === 'error'),
            ),
        )
        .filter((pair) => expectedPairs.has(`${pair.left}\u0000${pair.right}`))
        .map((pair) => ({
          explanation:
            typeof pair.explanation === 'string'
              ? pair.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
          left: pair.left,
          right: pair.right,
          status: pair.status,
        }))
    : [];

  return reviews.length > 0 ? { pairs: reviews } : undefined;
}
