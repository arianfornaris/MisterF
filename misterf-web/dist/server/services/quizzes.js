import { z } from 'zod';
import { quizBlockSchema as tutorQuizBlockSchema, quizItemSchema, quizResultBlockSchema, } from './llmTutor/schemas.js';
import { evaluateQuizResultItemsWithLlm } from './llmTutor/index.js';
function stripQuizUnsupportedFields(value) {
    if (Array.isArray(value)) {
        return value.map(stripQuizUnsupportedFields);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const draft = { ...value };
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
export const quizBlockSchema = z.preprocess(stripQuizUnsupportedFields, z.object({
    id: quizEntityIdSchema,
    item: quizItemSchema,
    sectionId: quizEntityIdSchema.optional(),
})
    .strict());
export const quizSectionSchema = z.preprocess(stripQuizUnsupportedFields, z.object({
    id: quizEntityIdSchema,
    instructions: z.string().trim().min(1).max(2000),
    title: z.string().trim().min(1).max(200).optional(),
})
    .strict());
export const quizDraftSchema = z.preprocess(stripQuizUnsupportedFields, z.object({
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
    const seenIds = new Set();
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
    const seenSectionIds = new Set();
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
}));
export function parseQuizDraft(value) {
    return quizDraftSchema.parse(value);
}
export function safeParseQuizDraft(value) {
    const parsed = quizDraftSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}
export function storedQuizToDraft(quiz) {
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
export function quizDraftToQuizBlock(draft) {
    const quiz = {
        items: draft.blocks.map((block) => block.item),
        prompt: draft.instructions || draft.description || draft.title,
        title: draft.title,
        type: 'quiz',
    };
    return tutorQuizBlockSchema.parse(quiz);
}
export function quizDraftToStudentQuizBlock(draft) {
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
export function buildQuizBlockSectionList(draft) {
    const sectionsById = new Map(draft.sections.map((section) => [section.id, section]));
    return draft.blocks.map((block) => block.sectionId ? sectionsById.get(block.sectionId) ?? null : null);
}
/**
 * Groups block indexes by section for the LLM evaluator, so section-level
 * instructions still apply to items whose prompt does not repeat them.
 */
export function buildQuizEvaluationSections(draft) {
    const itemIndexesBySection = new Map();
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
function buildStudentQuizItem(item) {
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
export function createQuizDraftFromManualInput(input) {
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
/**
 * Reorders blocks so every section's blocks are contiguous: unsectioned
 * blocks first, then each section in sections-array order. The sort is
 * stable, so relative order inside each group is preserved. Apply it after
 * AI generation/revision and section edits; never on stored attempt
 * snapshots, where responses are aligned to the saved block order.
 */
export function canonicalizeQuizDraftBlockOrder(draft) {
    if (draft.sections.length === 0) {
        return draft;
    }
    const sectionRank = new Map(draft.sections.map((section, index) => [section.id, index + 1]));
    const blocks = draft.blocks
        .slice()
        .sort((a, b) => (a.sectionId ? sectionRank.get(a.sectionId) ?? 0 : 0) -
        (b.sectionId ? sectionRank.get(b.sectionId) ?? 0 : 0));
    return quizDraftSchema.parse({
        ...draft,
        blocks,
    });
}
export function upsertQuizSection(draft, input) {
    const existingSection = input.sectionId
        ? draft.sections.find((section) => section.id === input.sectionId)
        : undefined;
    const sectionId = existingSection
        ? existingSection.id
        : ensureUniqueSectionId(input.title || 'seccion', draft.sections);
    const nextSection = {
        id: sectionId,
        instructions: input.instructions,
        ...(input.title ? { title: input.title } : {}),
    };
    const sections = existingSection
        ? draft.sections.map((section) => (section.id === sectionId ? nextSection : section))
        : [...draft.sections, nextSection];
    const memberBlockIds = new Set(input.blockIds);
    const blocks = draft.blocks.map((block) => {
        if (memberBlockIds.has(block.id)) {
            return { ...block, sectionId };
        }
        if (block.sectionId === sectionId) {
            const { sectionId: _removed, ...rest } = block;
            return rest;
        }
        return block;
    });
    return canonicalizeQuizDraftBlockOrder(quizDraftSchema.parse({
        ...draft,
        blocks,
        sections,
    }));
}
export function removeQuizSection(draft, sectionId) {
    if (!draft.sections.some((section) => section.id === sectionId)) {
        return draft;
    }
    return quizDraftSchema.parse({
        ...draft,
        blocks: draft.blocks.map((block) => {
            if (block.sectionId !== sectionId) {
                return block;
            }
            const { sectionId: _removed, ...rest } = block;
            return rest;
        }),
        sections: draft.sections.filter((section) => section.id !== sectionId),
    });
}
export function appendQuizBlock(draft, block) {
    const lastBlock = draft.blocks[draft.blocks.length - 1];
    const validSectionIds = new Set(draft.sections.map((section) => section.id));
    // Keep the new block at the visual end of the list: reuse its sectionId
    // only when valid, otherwise inherit the section of the last block.
    const sectionId = block.sectionId && validSectionIds.has(block.sectionId)
        ? block.sectionId
        : lastBlock?.sectionId;
    return canonicalizeQuizDraftBlockOrder(quizDraftSchema.parse({
        ...draft,
        blocks: [
            ...draft.blocks,
            {
                id: ensureUniqueBlockId(block.id, draft.blocks),
                item: block.item,
                ...(sectionId ? { sectionId } : {}),
            },
        ],
    }));
}
export function removeQuizBlock(draft, blockId) {
    return quizDraftSchema.parse({
        ...draft,
        blocks: draft.blocks.filter((block) => block.id !== blockId),
    });
}
export function duplicateQuizBlock(draft, blockId) {
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
export function moveQuizBlock(draft, blockId, direction) {
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
export function normalizeQuizResponses(input) {
    return input.draft.blocks.map((block, index) => {
        const item = block.item;
        const fieldPrefix = `response_${index}`;
        if (item.kind === 'quiz_open_text' ||
            item.kind === 'quiz_translate_to_english' ||
            item.kind === 'quiz_understand_in_spanish') {
            return {
                text: readFormString(input.body[`${fieldPrefix}_text`], 2400),
            };
        }
        if (item.kind === 'quiz_fill_in_the_blank_input' ||
            item.kind === 'quiz_fill_in_the_blank_choice') {
            const values = item.blanks.map((_blank, blankIndex) => readFormString(input.body[`${fieldPrefix}_blank_${blankIndex}`], 240));
            const placeholderToken = item.kind === 'quiz_fill_in_the_blank_choice' ? '{{blank}}' : '___';
            return {
                completedSentence: fillSentencePlaceholders(item.sentence, values, placeholderToken),
                values,
            };
        }
        if (item.kind === 'quiz_multiple_choice') {
            const selectedOptions = readFormStringArray(input.body[`${fieldPrefix}_selectedOptions`], 400).filter((option) => item.options.includes(option));
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
export async function evaluateQuizAttempt(input) {
    const draft = parseQuizDraft(input.attempt.snapshot);
    const quiz = quizDraftToQuizBlock(draft);
    const responses = normalizeStoredResponses(input.attempt.responses);
    const evaluations = await evaluateQuizResultItemsWithLlm({
        evaluationInstructions: draft.evaluationInstructions,
        llm: input.llm,
        quiz,
        responses,
        sections: buildQuizEvaluationSections(draft),
    });
    return quizResultBlockSchema.parse(buildQuizResultBlock({
        draft,
        evaluations,
        responses,
    }));
}
export function buildQuizEvaluationSummary(result) {
    const summary = {
        correctCount: 0,
        incorrectCount: 0,
        partialCount: 0,
        totalCount: result.items.length,
    };
    for (const item of result.items) {
        if (item.evaluation.status === 'correct') {
            summary.correctCount += 1;
        }
        else if (item.evaluation.status === 'partial') {
            summary.partialCount += 1;
        }
        else {
            summary.incorrectCount += 1;
        }
    }
    return summary;
}
export function buildQuizResultTitle(result) {
    const summary = buildQuizEvaluationSummary(result);
    return `${summary.correctCount}/${summary.totalCount} respuestas correctas`;
}
export function buildQuizResultBlock(input) {
    return {
        items: input.draft.blocks.map((block, index) => buildQuizResultItem({
            evaluation: input.evaluations[index] ?? {
                feedback: 'Miremos esta respuesta con más detalle en la siguiente práctica.',
                status: 'partial',
            },
            item: block.item,
            response: input.responses[index] ?? {},
        })),
        prompt: input.draft.instructions || input.draft.description || input.draft.title,
        title: input.draft.title,
        type: 'quiz_result',
    };
}
function buildQuizResultItem(input) {
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
function normalizeStoredResponses(values) {
    return values.map((value) => value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {});
}
function ensureUniqueBlockId(id, blocks) {
    return ensureUniqueEntityId(id, 'block', new Set(blocks.map((block) => block.id)));
}
function ensureUniqueSectionId(id, sections) {
    return ensureUniqueEntityId(id, 'seccion', new Set(sections.map((section) => section.id)));
}
function ensureUniqueEntityId(id, fallbackBaseId, usedIds) {
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
function fillSentencePlaceholders(sentence, values, placeholderToken) {
    let completedSentence = sentence;
    for (const value of values) {
        completedSentence = completedSentence.replace(placeholderToken, value.trim());
    }
    return completedSentence.replace(/\s+/g, ' ').trim();
}
function readFormString(value, maxLength) {
    if (Array.isArray(value)) {
        return readFormString(value[0], maxLength);
    }
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}
function readFormStringArray(value, maxLength) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const seen = new Set();
    const result = [];
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
function readStoredString(value, maxLength) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}
function readStoredOptionalString(value, maxLength) {
    const normalized = readStoredString(value, maxLength);
    return normalized || undefined;
}
function readStoredStringArray(value, maxLength) {
    return Array.isArray(value)
        ? value
            .map((item) => readStoredString(item, maxLength))
            .filter(Boolean)
        : [];
}
function readStoredPairs(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((pair) => {
        if (!pair || typeof pair !== 'object') {
            return null;
        }
        const record = pair;
        const left = readStoredString(record.left, 600);
        const right = readStoredString(record.right, 600);
        return left && right ? { left, right } : null;
    })
        .filter((pair) => Boolean(pair));
}
function normalizeTextInlineReview(value) {
    const parts = Array.isArray(value?.parts)
        ? value.parts
            .filter((part) => Boolean(part &&
            typeof part === 'object' &&
            typeof part.text === 'string' &&
            (part.status === 'correct' || part.status === 'improve' || part.status === 'error')))
            .map((part) => ({
            explanation: typeof part.explanation === 'string'
                ? part.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
            status: part.status,
            text: part.text.replace(/\s+/g, ' ').trim().slice(0, 2400),
        }))
            .filter((part) => part.text)
        : [];
    return parts.length > 0 ? { parts } : undefined;
}
function normalizeBlankInlineReview(value, expectedLength) {
    const blanks = Array.isArray(value?.blanks)
        ? value.blanks
            .slice(0, expectedLength)
            .filter((blank) => Boolean(blank &&
            typeof blank === 'object' &&
            (blank.status === 'correct' || blank.status === 'improve' || blank.status === 'error')))
            .map((blank) => ({
            explanation: typeof blank.explanation === 'string'
                ? blank.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
            status: blank.status,
        }))
        : [];
    return blanks.length > 0 ? { blanks } : undefined;
}
function normalizeMultipleChoiceInlineReview(value, options) {
    const reviews = Array.isArray(value?.options)
        ? value.options
            .filter((option) => Boolean(option &&
            typeof option === 'object' &&
            typeof option.text === 'string' &&
            typeof option.selectedByUser === 'boolean' &&
            (option.status === 'correct' ||
                option.status === 'neutral' ||
                option.status === 'missed' ||
                option.status === 'error')))
            .filter((option) => options.includes(option.text))
            .map((option) => ({
            explanation: typeof option.explanation === 'string'
                ? option.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
            selectedByUser: option.selectedByUser,
            status: option.status,
            text: option.text,
        }))
        : [];
    return reviews.length > 0 ? { options: reviews } : undefined;
}
function normalizeMatchingPairsInlineReview(value, pairs) {
    const expectedPairs = new Set(pairs.map((pair) => `${pair.left}\u0000${pair.right}`));
    const reviews = Array.isArray(value?.pairs)
        ? value.pairs
            .filter((pair) => Boolean(pair &&
            typeof pair === 'object' &&
            typeof pair.left === 'string' &&
            typeof pair.right === 'string' &&
            (pair.status === 'correct' || pair.status === 'error')))
            .filter((pair) => expectedPairs.has(`${pair.left}\u0000${pair.right}`))
            .map((pair) => ({
            explanation: typeof pair.explanation === 'string'
                ? pair.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
            left: pair.left,
            right: pair.right,
            status: pair.status,
        }))
        : [];
    return reviews.length > 0 ? { pairs: reviews } : undefined;
}
//# sourceMappingURL=quizzes.js.map