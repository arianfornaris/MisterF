import { z } from 'zod';
import { translate, type Locale } from '../i18n/index.js';
import type {
  TutorQuizBlock,
  TutorQuizItem,
  TutorQuizResultBlock,
} from './llmTutor/types.js';
import {
  quizBlockSchema as tutorQuizBlockSchema,
  quizItemSchema,
  quizResultBlockSchema,
} from './llmTutor/schemas.js';
import { evaluateQuizResultItemsWithLlm } from './llmTutor/index.js';
import type { LlmRequestOptions } from './llmTutor/types.js';
import type {
  StoredQuiz,
  StoredQuizAttempt,
} from '../db/repository.js';

function stripQuizUnsupportedFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripQuizUnsupportedFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const draft = { ...(value as Record<string, unknown>) };
  delete draft.estimatedMinutes;
  delete draft.rubric;
  for (const [key, nestedValue] of Object.entries(draft)) {
    draft[key] = stripQuizUnsupportedFields(nestedValue);
  }
  return draft;
}

const quizEntityIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/);

export const quizBlockSchema = z.preprocess(
  stripQuizUnsupportedFields,
  z.object({
    id: quizEntityIdSchema,
    item: quizItemSchema,
    sectionId: quizEntityIdSchema.optional(),
  })
  .strict(),
);

export const quizSectionSchema = z.preprocess(
  stripQuizUnsupportedFields,
  z.object({
    id: quizEntityIdSchema,
    instructions: z.string().trim().min(1).max(2000),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict(),
);

export const quizDraftSchema = z.preprocess(
  stripQuizUnsupportedFields,
  z.object({
    blocks: z.array(quizBlockSchema).min(1),
    description: z.string().trim().max(1500).default(''),
    evaluationInstructions: z.string().trim().max(3000).default(''),
    instructions: z.string().trim().max(3000).default(''),
    level: z.string().trim().max(120).default(''),
    sections: z.array(quizSectionSchema).default([]),
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
          message: 'Block ids must be unique within an quiz draft.',
          path: ['blocks', index, 'id'],
        });
      }

      seenIds.add(normalizedId);
    });

    const seenSectionIds = new Set<string>();
    draft.sections.forEach((section, index) => {
      const normalizedId = section.id.toLowerCase();
      if (seenSectionIds.has(normalizedId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Section ids must be unique within an quiz draft.',
          path: ['sections', index, 'id'],
        });
      }

      seenSectionIds.add(normalizedId);
    });

    draft.blocks.forEach((block, index) => {
      if (block.sectionId && !seenSectionIds.has(block.sectionId.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Every block sectionId must reference an existing section id.',
          path: ['blocks', index, 'sectionId'],
        });
      }
    });
  }),
);

export type QuizBlock = z.infer<typeof quizBlockSchema>;
export type QuizSection = z.infer<typeof quizSectionSchema>;
export type QuizDraft = z.infer<typeof quizDraftSchema>;

/**
 * The quiz's `General` tab metadata: everything a teacher edits without
 * touching blocks or sections. This is the exact scope of the metadata AI
 * modification operation, kept as its own contract so a metadata revision can
 * never emit or alter block content.
 */
export const quizMetadataSchema = z
  .object({
    description: z.string().trim().max(1500).default(''),
    evaluationInstructions: z.string().trim().max(3000).default(''),
    instructions: z.string().trim().max(3000).default(''),
    level: z.string().trim().max(120).default(''),
    targetTopic: z.string().trim().max(220).default(''),
    title: z.string().trim().min(1).max(220),
  })
  .strict();

export type QuizMetadata = z.infer<typeof quizMetadataSchema>;

export function safeParseQuizMetadata(value: unknown): QuizMetadata | null {
  const parsed = quizMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type QuizEvaluationSummary = {
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  totalCount: number;
};

export type QuizStudentQuizItem =
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
    }
  | {
      kind: 'quiz_order_sentences';
      prompt: string;
      sentences: string[];
    };

export type QuizStudentQuizSection = {
  id: string;
  instructions: string;
  title?: string;
};

export type QuizStudentQuizBlock = {
  items: Array<QuizStudentQuizItem & { section?: QuizStudentQuizSection }>;
  prompt: string;
  title: string;
  type: 'quiz';
};

export function parseQuizDraft(value: unknown): QuizDraft {
  return quizDraftSchema.parse(value);
}

export function safeParseQuizDraft(value: unknown): QuizDraft | null {
  const parsed = quizDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function storedQuizToDraft(quiz: StoredQuiz): QuizDraft {
  const parsed = safeParseQuizDraft(quiz.quiz);
  if (parsed) {
    return parsed;
  }

  return {
    blocks: [],
    description: quiz.description,
    evaluationInstructions: '',
    instructions: quiz.instructions,
    level: quiz.level,
    sections: [],
    targetTopic: quiz.targetTopic,
    title: quiz.title,
  };
}

export function quizDraftToQuizBlock(draft: QuizDraft): TutorQuizBlock {
  const quiz = {
    items: draft.blocks.map((block) => block.item),
    prompt: draft.instructions || draft.description || draft.title,
    title: draft.title,
    type: 'quiz' as const,
  };

  return tutorQuizBlockSchema.parse(quiz);
}

export function quizDraftToStudentQuizBlock(draft: QuizDraft): QuizStudentQuizBlock {
  const sectionList = buildQuizBlockSectionList(draft);
  return {
    items: draft.blocks.map((block, index) => {
      const section = sectionList[index];
      return {
        ...buildStudentQuizItem(block.item),
        ...(section
          ? {
              section: {
                id: section.id,
                instructions: section.instructions,
                ...(section.title ? { title: section.title } : {}),
              },
            }
          : {}),
      };
    }),
    prompt: draft.instructions || draft.description || draft.title,
    title: draft.title,
    type: 'quiz',
  };
}

/**
 * Returns, for each block (aligned by index), the section it belongs to or
 * null when the block is not grouped under any section.
 */
export function buildQuizBlockSectionList(draft: QuizDraft): Array<QuizSection | null> {
  const sectionsById = new Map(draft.sections.map((section) => [section.id, section]));
  return draft.blocks.map((block) =>
    block.sectionId ? sectionsById.get(block.sectionId) ?? null : null,
  );
}

/**
 * Groups block indexes by section for the LLM evaluator, so section-level
 * instructions still apply to items whose prompt does not repeat them.
 */
export function buildQuizEvaluationSections(draft: QuizDraft): Array<{
  instructions: string;
  itemIndexes: number[];
  title?: string;
}> {
  const itemIndexesBySection = new Map<string, number[]>();
  draft.blocks.forEach((block, index) => {
    if (!block.sectionId) {
      return;
    }

    const indexes = itemIndexesBySection.get(block.sectionId) ?? [];
    indexes.push(index);
    itemIndexesBySection.set(block.sectionId, indexes);
  });

  return draft.sections
    .filter((section) => (itemIndexesBySection.get(section.id) ?? []).length > 0)
    .map((section) => ({
      instructions: section.instructions,
      itemIndexes: itemIndexesBySection.get(section.id) ?? [],
      ...(section.title ? { title: section.title } : {}),
    }));
}

function buildStudentQuizItem(item: TutorQuizItem): QuizStudentQuizItem {
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

  if (item.kind === 'quiz_order_sentences') {
    return {
      kind: item.kind,
      prompt: item.prompt,
      sentences: item.sentences,
    };
  }

  return {
    kind: item.kind,
    prompt: item.prompt,
    tokens: item.tokens,
  };
}

export function createQuizDraftFromManualInput(input: {
  description: string;
  evaluationInstructions: string;
  instructions: string;
  level: string;
  previousDraft: QuizDraft;
  targetTopic: string;
  title: string;
}): QuizDraft {
  return quizDraftSchema.parse({
    ...input.previousDraft,
    description: input.description,
    evaluationInstructions: input.evaluationInstructions,
    instructions: input.instructions,
    level: input.level,
    targetTopic: input.targetTopic,
    title: input.title,
  });
}

export function quizDraftToMetadata(draft: QuizDraft): QuizMetadata {
  return quizMetadataSchema.parse({
    description: draft.description,
    evaluationInstructions: draft.evaluationInstructions,
    instructions: draft.instructions,
    level: draft.level,
    targetTopic: draft.targetTopic,
    title: draft.title,
  });
}

/**
 * Applies revised metadata onto an existing draft, preserving its blocks and
 * sections untouched. Used by the metadata AI modification operation so a
 * `General`-tab change can never rewrite block content.
 */
export function applyQuizMetadataToDraft(
  previousDraft: QuizDraft,
  metadata: QuizMetadata,
): QuizDraft {
  return createQuizDraftFromManualInput({
    description: metadata.description,
    evaluationInstructions: metadata.evaluationInstructions,
    instructions: metadata.instructions,
    level: metadata.level,
    previousDraft,
    targetTopic: metadata.targetTopic,
    title: metadata.title || previousDraft.title,
  });
}

/**
 * Replaces a draft's blocks and sections while preserving its metadata (title,
 * description, topic, level, instructions, evaluation instructions). Used by the
 * `Bloques`-tab AI modification operation so a whole-tab change can never
 * rewrite the general details owned by the `General` tab.
 */
export function applyQuizBlocksAndSectionsToDraft(
  previousDraft: QuizDraft,
  blocks: QuizBlock[],
  sections: QuizSection[],
): QuizDraft {
  return canonicalizeQuizDraftBlockOrder(
    quizDraftSchema.parse({
      ...quizDraftToMetadata(previousDraft),
      blocks,
      sections,
    }),
  );
}

export type QuizBlockDiffStatus = 'added' | 'changed' | 'moved' | 'unchanged';

export type QuizBlocksDiff = {
  blocks: Array<{
    id: string;
    item: TutorQuizItem;
    sectionId?: string;
    status: QuizBlockDiffStatus;
  }>;
  removed: Array<{ id: string; item: TutorQuizItem }>;
  sections: {
    added: string[];
    changed: string[];
    removed: string[];
  };
  summary: {
    added: number;
    changed: number;
    moved: number;
    removed: number;
  };
};

/**
 * Computes a block-by-block and section diff between two drafts for the
 * `Bloques` modification preview. A block is `added` when its id is new,
 * `changed` when its item content differs, `moved` when the same content
 * changes position or section, and `unchanged` otherwise. Returns the proposed
 * blocks in their proposed order plus the list of removed blocks.
 */
export function diffQuizBlocks(before: QuizDraft, after: QuizDraft): QuizBlocksDiff {
  const beforeById = new Map(before.blocks.map((block, index) => [block.id, { block, index }]));
  const afterIds = new Set(after.blocks.map((block) => block.id));

  const blocks = after.blocks.map((block, index) => {
    const previous = beforeById.get(block.id);
    let status: QuizBlockDiffStatus;
    if (!previous) {
      status = 'added';
    } else if (JSON.stringify(previous.block.item) !== JSON.stringify(block.item)) {
      status = 'changed';
    } else if (previous.index !== index || previous.block.sectionId !== block.sectionId) {
      status = 'moved';
    } else {
      status = 'unchanged';
    }
    return {
      id: block.id,
      item: block.item,
      sectionId: block.sectionId,
      status,
    };
  });

  const removed = before.blocks
    .filter((block) => !afterIds.has(block.id))
    .map((block) => ({ id: block.id, item: block.item }));

  const beforeSectionById = new Map(before.sections.map((section) => [section.id, section]));
  const afterSectionById = new Map(after.sections.map((section) => [section.id, section]));
  const sections = {
    added: after.sections
      .filter((section) => !beforeSectionById.has(section.id))
      .map((section) => section.id),
    changed: after.sections
      .filter((section) => {
        const previous = beforeSectionById.get(section.id);
        return (
          previous
          && (previous.title !== section.title
            || previous.instructions !== section.instructions)
        );
      })
      .map((section) => section.id),
    removed: before.sections
      .filter((section) => !afterSectionById.has(section.id))
      .map((section) => section.id),
  };

  return {
    blocks,
    removed,
    sections,
    summary: {
      added: blocks.filter((block) => block.status === 'added').length,
      changed: blocks.filter((block) => block.status === 'changed').length,
      moved: blocks.filter((block) => block.status === 'moved').length,
      removed: removed.length,
    },
  };
}

export function quizBlocksDiffHasChanges(diff: QuizBlocksDiff): boolean {
  return (
    diff.summary.added > 0
    || diff.summary.changed > 0
    || diff.summary.moved > 0
    || diff.summary.removed > 0
    || diff.sections.added.length > 0
    || diff.sections.changed.length > 0
    || diff.sections.removed.length > 0
  );
}

/**
 * Reorders blocks so every section's blocks are contiguous: unsectioned
 * blocks first, then each section in sections-array order. The sort is
 * stable, so relative order inside each group is preserved. Apply it after
 * AI generation/revision and section edits; never on stored attempt
 * snapshots, where responses are aligned to the saved block order.
 */
export function canonicalizeQuizDraftBlockOrder(draft: QuizDraft): QuizDraft {
  if (draft.sections.length === 0) {
    return draft;
  }

  const sectionRank = new Map(draft.sections.map((section, index) => [section.id, index + 1]));
  const blocks = draft.blocks
    .slice()
    .sort(
      (a, b) =>
        (a.sectionId ? sectionRank.get(a.sectionId) ?? 0 : 0) -
        (b.sectionId ? sectionRank.get(b.sectionId) ?? 0 : 0),
    );

  return quizDraftSchema.parse({
    ...draft,
    blocks,
  });
}

export function findQuizBlock(
  draft: QuizDraft,
  blockId: string,
): QuizBlock | undefined {
  return draft.blocks.find((block) => block.id === blockId);
}

/**
 * Replaces a single block's item, preserving the block id, its section, and
 * every other block. Used by the per-block AI modification operation so a
 * block-scoped change can never alter another block. Returns the unchanged
 * draft when the block id is not found.
 */
export function setQuizBlockItem(
  draft: QuizDraft,
  blockId: string,
  item: TutorQuizItem,
): QuizDraft {
  if (!draft.blocks.some((block) => block.id === blockId)) {
    return draft;
  }

  return quizDraftSchema.parse({
    ...draft,
    blocks: draft.blocks.map((block) =>
      block.id === blockId ? { ...block, item } : block,
    ),
  });
}

export function removeQuizBlock(
  draft: QuizDraft,
  blockId: string,
): QuizDraft {
  return quizDraftSchema.parse({
    ...draft,
    blocks: draft.blocks.filter((block) => block.id !== blockId),
  });
}

/**
 * Inserts a new block carrying `item` into the draft. Placement is explicit:
 * an optional `sectionId` (ignored when it does not match a declared section)
 * and a `position` within the resulting order. The block gets a fresh unique
 * id; the returned order is canonicalized so section grouping stays valid.
 * Used by the add-block AI operation.
 */
export function insertQuizBlock(
  draft: QuizDraft,
  item: TutorQuizItem,
  placement: { position?: 'end' | 'start'; sectionId?: string } = {},
): { blockId: string; draft: QuizDraft } {
  const sectionId =
    placement.sectionId
    && draft.sections.some((section) => section.id === placement.sectionId)
      ? placement.sectionId
      : undefined;
  const blockId = ensureUniqueBlockId('block', draft.blocks);
  const newBlock: QuizBlock = sectionId
    ? { id: blockId, item, sectionId }
    : { id: blockId, item };

  const blocks =
    placement.position === 'start'
      ? [newBlock, ...draft.blocks]
      : [...draft.blocks, newBlock];

  return {
    blockId,
    draft: canonicalizeQuizDraftBlockOrder(
      quizDraftSchema.parse({ ...draft, blocks }),
    ),
  };
}

export function duplicateQuizBlock(
  draft: QuizDraft,
  blockId: string,
): QuizDraft {
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

  return quizDraftSchema.parse({
    ...draft,
    blocks,
  });
}

export function moveQuizBlock(
  draft: QuizDraft,
  blockId: string,
  direction: 'down' | 'up',
): QuizDraft {
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

  // Moving against a neighbor from another section crosses a section
  // boundary: the block adopts the neighbor's section and keeps its
  // position, so it shows up under the adjacent header instead of jumping
  // over the whole group.
  const neighbor = draft.blocks[nextIndex];
  if (neighbor && neighbor.sectionId !== block.sectionId) {
    const { sectionId: _removed, ...rest } = block;
    blocks.splice(currentIndex, 0, {
      ...rest,
      ...(neighbor.sectionId ? { sectionId: neighbor.sectionId } : {}),
    });
    return quizDraftSchema.parse({
      ...draft,
      blocks,
    });
  }

  blocks.splice(nextIndex, 0, block);
  return quizDraftSchema.parse({
    ...draft,
    blocks,
  });
}

export function normalizeQuizResponses(input: {
  body: Record<string, unknown>;
  draft: QuizDraft;
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

    if (item.kind === 'quiz_order_sentences') {
      return {
        orderedSentences: item.sentences
          .map((_sentence, positionIndex) =>
            readFormString(input.body[`${fieldPrefix}_order_${positionIndex}`], 400),
          )
          .filter((sentence) => item.sentences.includes(sentence)),
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

export async function evaluateQuizAttempt(input: {
  attempt: StoredQuizAttempt;
  instructionLanguage?: Locale;
  llm?: LlmRequestOptions;
}): Promise<TutorQuizResultBlock> {
  const draft = parseQuizDraft(input.attempt.snapshot);
  const quiz = quizDraftToQuizBlock(draft);
  const responses = normalizeStoredResponses(input.attempt.responses);
  const evaluation = await evaluateQuizResultItemsWithLlm({
    evaluationInstructions: draft.evaluationInstructions,
    instructionLanguage: input.instructionLanguage,
    llm: input.llm,
    quiz,
    responses,
    sections: buildQuizEvaluationSections(draft),
  });

  return quizResultBlockSchema.parse(
    buildQuizResultBlock({
      draft,
      evaluations: evaluation.items,
      locale: input.instructionLanguage,
      overall: evaluation.overall,
      responses,
    }),
  );
}

export function buildQuizEvaluationSummary(
  result: TutorQuizResultBlock,
): QuizEvaluationSummary {
  const summary: QuizEvaluationSummary = {
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

export type QuizResponsesQuestionStat = {
  correct: number;
  incorrect: number;
  partial: number;
  prompt: string;
  total: number;
};

export type QuizResponsesSummary = {
  evaluatedCount: number;
  questions: QuizResponsesQuestionStat[];
  respondedCount: number;
};

/**
 * Live, deterministic aggregation of the responses collected for a quiz. Not
 * persisted: it is recomputed from the current attempts on every view, so it
 * always reflects reality (a stored report would go stale the moment a new
 * participant responds). Per-question tallies are keyed by prompt text, so
 * they survive block reordering; questions are reported in the current quiz's
 * order. Only evaluated attempts contribute to the tallies; `respondedCount`
 * counts every collected attempt.
 */
export function buildQuizResponsesSummary(input: {
  attempts: Array<{ result: Record<string, unknown> | null; status: string }>;
  draft: QuizDraft;
}): QuizResponsesSummary {
  const tally = new Map<string, { correct: number; incorrect: number; partial: number }>();
  let evaluatedCount = 0;

  for (const attempt of input.attempts) {
    if (attempt.status !== 'evaluated' || !attempt.result) {
      continue;
    }
    const parsed = quizResultBlockSchema.safeParse(attempt.result);
    if (!parsed.success) {
      continue;
    }
    evaluatedCount += 1;
    for (const item of parsed.data.items) {
      const bucket = tally.get(item.prompt) ?? { correct: 0, incorrect: 0, partial: 0 };
      bucket[item.evaluation.status] += 1;
      tally.set(item.prompt, bucket);
    }
  }

  const questions: QuizResponsesQuestionStat[] = input.draft.blocks.map((block) => {
    const bucket = tally.get(block.item.prompt) ?? { correct: 0, incorrect: 0, partial: 0 };
    return {
      correct: bucket.correct,
      incorrect: bucket.incorrect,
      partial: bucket.partial,
      prompt: block.item.prompt,
      total: bucket.correct + bucket.incorrect + bucket.partial,
    };
  });

  return {
    evaluatedCount,
    questions,
    respondedCount: input.attempts.length,
  };
}

/**
 * Fingerprint of the inputs an AI summary was generated from, so a stored
 * summary can be flagged stale when new responses arrive. Derived from the
 * evaluated attempts that feed the summary: their count plus the latest
 * update timestamp. If either changes (a new evaluated response, or one
 * re-evaluated), the fingerprint changes and the owner sees a "regenerate"
 * prompt.
 */
export function computeQuizResponsesFingerprint(
  attempts: Array<{ result: Record<string, unknown> | null; status: string; updatedAt: string }>,
): string {
  let evaluatedCount = 0;
  let latestUpdatedAt = '';
  for (const attempt of attempts) {
    if (attempt.status !== 'evaluated' || !attempt.result) {
      continue;
    }
    evaluatedCount += 1;
    if (attempt.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = attempt.updatedAt;
    }
  }
  return `${evaluatedCount}:${latestUpdatedAt}`;
}

export function buildQuizResultTitle(
  result: TutorQuizResultBlock,
  locale: Locale = 'es',
): string {
  const summary = buildQuizEvaluationSummary(result);
  return translate(locale, 'msg.quizCorrectAnswers', {
    correct: summary.correctCount,
    total: summary.totalCount,
  });
}

export function buildQuizResultBlock(input: {
  draft: QuizDraft;
  evaluations: Array<{
    feedback: string;
    inlineReview?: Record<string, unknown>;
    status: 'correct' | 'incorrect' | 'partial';
  }>;
  locale?: Locale;
  overall?: string;
  responses: Array<Record<string, unknown>>;
}): TutorQuizResultBlock {
  const overall = input.overall?.trim();
  return {
    items: input.draft.blocks.map((block, index) =>
      buildQuizResultItem({
        evaluation: input.evaluations[index] ?? {
          feedback: translate(input.locale ?? 'es', 'msg.lookCloser'),
          status: 'partial' as const,
        },
        item: block.item,
        response: input.responses[index] ?? {},
      }),
    ),
    ...(overall ? { overall } : {}),
    prompt: input.draft.instructions || input.draft.description || input.draft.title,
    title: input.draft.title,
    type: 'quiz_result',
  };
}

function buildQuizResultItem(input: {
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

  if (item.kind === 'quiz_order_sentences') {
    return {
      evaluation: resultEvaluation,
      inlineReview: normalizeOrderSentencesInlineReview(
        evaluation.inlineReview,
        item.sentences.length,
      ),
      kind: item.kind,
      prompt: item.prompt,
      sentences: item.sentences,
      userResponse: {
        orderedSentences: readStoredStringArray(response.orderedSentences, 400)
          .slice(0, item.sentences.length),
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

function ensureUniqueBlockId(id: string, blocks: QuizBlock[]): string {
  return ensureUniqueEntityId(id, 'block', new Set(blocks.map((block) => block.id)));
}

function ensureUniqueEntityId(
  id: string,
  fallbackBaseId: string,
  usedIds: Set<string>,
): string {
  const baseId = id
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '') || fallbackBaseId;
  const paddedBaseId = baseId.length < 3 ? `${baseId}_x`.slice(0, 3) : baseId;
  let nextId = paddedBaseId.slice(0, 56);
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${paddedBaseId.slice(0, 50)}_${suffix}`;
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

function normalizeOrderSentencesInlineReview(
  value: Record<string, unknown> | undefined,
  expectedLength: number,
): { sentences: Array<{ explanation?: string; status: 'correct' | 'improve' | 'error' }> } | undefined {
  const sentences = Array.isArray(value?.sentences)
    ? value.sentences
        .slice(0, expectedLength)
        .filter(
          (sentence): sentence is { explanation?: string; status: 'correct' | 'improve' | 'error' } =>
            Boolean(
              sentence &&
                typeof sentence === 'object' &&
                (sentence.status === 'correct' ||
                  sentence.status === 'improve' ||
                  sentence.status === 'error'),
            ),
        )
        .map((sentence) => ({
          explanation:
            typeof sentence.explanation === 'string'
              ? sentence.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
          status: sentence.status,
        }))
    : [];

  return sentences.length > 0 ? { sentences } : undefined;
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
