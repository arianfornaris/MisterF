import { z } from 'zod';
import { TutorResponseValidationError } from './errors.js';
import { logger } from '../logger.js';
import { shouldLogFullLlmTrace } from './logging.js';
import { tutorAgentResponseSchema, tutorPlanStepIdMaxLength, } from './schemas.js';
import { translate } from '../../i18n/index.js';
import { defaultInstructionLanguage } from './languagePack.js';
export function toModelMessage(message) {
    return {
        content: message.content,
        role: message.role === 'model' ? 'assistant' : 'user',
    };
}
/**
 * Block types that render chat content. Plan blocks (`tutor_plan`,
 * `tutor_plan_update`) are excluded: they update the plan panel, so a
 * response made only of them would leave the tutor's turn silent.
 * `blocksToMarkdown` and the plan-only validation below share this set.
 */
const visibleTutorBlockTypes = new Set([
    'message',
    'dialogue_character_message',
    'dialogue_transcript',
    'matching_pairs',
    'quiz',
    'quiz_result',
    'translate_to_english_prompt',
    'understand_in_spanish_prompt',
    'open_text_prompt',
    'fill_in_the_blank_input',
    'fill_in_the_blank_choice',
    'multiple_choice',
    'unscramble_sentence',
    'order_sentences',
    'sentence_evaluation',
]);
function isVisibleTutorBlock(block) {
    return visibleTutorBlockTypes.has(block.type);
}
export function validateTutorResponseBlocks(value, options = {}) {
    const parsed = tutorAgentResponseSchema.safeParse(sanitizeTutorResponse(value));
    if (!parsed.success) {
        const fullTrace = shouldLogFullLlmTrace({
            conversationId: options.conversationId,
            userId: options.userId ?? options.llm?.userId ?? null,
        });
        logger.warn('llm_response_validation_failed', {
            conversationId: options.conversationId ?? null,
            fullTrace,
            issues: parsed.error.issues,
            operation: options.operation ?? 'tutor',
            userId: options.userId ?? options.llm?.userId ?? null,
            value: fullTrace ? value : undefined,
            valueSummary: summarizeInvalidTutorResponse(value),
        });
        throw new TutorResponseValidationError({
            generatedText: options.generatedText,
            issues: parsed.error.issues,
        });
    }
    const blocks = parsed.data.blocks;
    if (blocks.length > 0 && !blocks.some((block) => visibleTutorBlockTypes.has(block.type))) {
        logger.warn('llm_plan_only_response_rejected', {
            blockTypes: blocks.map((block) => block.type),
            conversationId: options.conversationId ?? null,
            operation: options.operation ?? 'tutor',
            userId: options.userId ?? options.llm?.userId ?? null,
        });
        throw new TutorResponseValidationError({
            generatedText: options.generatedText,
            issues: [
                {
                    code: z.ZodIssueCode.custom,
                    message: 'The response contains only plan blocks (tutor_plan / tutor_plan_update). Every tutor response must include at least one visible block; pair plan changes with a `message` that narrates them.',
                    path: ['blocks'],
                },
            ],
        });
    }
    return blocks;
}
function summarizeInvalidTutorResponse(value) {
    if (!value || typeof value !== 'object') {
        return {
            type: value === null ? 'null' : typeof value,
        };
    }
    if (Array.isArray(value)) {
        return {
            itemCount: value.length,
            type: 'array',
        };
    }
    const record = value;
    return {
        blockCount: Array.isArray(record.blocks) ? record.blocks.length : null,
        keys: Object.keys(value),
        type: 'object',
    };
}
function sanitizeTutorResponse(value) {
    if (!value || typeof value !== 'object') {
        return value;
    }
    const record = value;
    if (!Array.isArray(record.blocks)) {
        return value;
    }
    return {
        ...record,
        blocks: record.blocks
            .map((block) => sanitizeTutorResponseBlock(block))
            .filter((block) => block !== null),
    };
}
function sanitizeTutorResponseBlock(block) {
    if (!block || typeof block !== 'object') {
        return block;
    }
    const record = block;
    if (record.type === 'tutor_plan') {
        return sanitizeTutorPlanBlock(record);
    }
    if (record.type === 'tutor_plan_update') {
        return sanitizeTutorPlanUpdateBlock(record);
    }
    if (record.type !== 'sentence_evaluation' || !Array.isArray(record.parts)) {
        return block;
    }
    const cleanedParts = record.parts.filter((part) => {
        if (!part || typeof part !== 'object') {
            return false;
        }
        const text = part.text;
        return typeof text === 'string' && text.trim().length > 0;
    });
    if (cleanedParts.length === 0) {
        return null;
    }
    return {
        ...record,
        parts: cleanedParts,
    };
}
/**
 * Plan step ids are internal and never shown to the learner, so a model that
 * writes them as prose (`"Práctica oral"`, `"Paso 1"`) should not cost the
 * learner a whole response. Normalize them into the slug the schema accepts
 * instead of rejecting the block. `tutor_plan` and `tutor_plan_update` share
 * this normalization, so an id the model repeats across turns keeps matching
 * the stored plan.
 */
function slugifyTutorPlanStepId(value) {
    if (typeof value !== 'string') {
        return value;
    }
    const slug = value
        .normalize('NFD')
        .replaceAll(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replaceAll(/[^a-z0-9_-]+/g, '_')
        .replace(/^[^a-z]+/, '')
        .slice(0, tutorPlanStepIdMaxLength);
    return slug || 'step';
}
/**
 * Two prose ids can normalize to the same slug (`"Práctica"` and `"practica"`).
 * The schema rejects duplicate ids inside a plan, so give the later step a
 * numbered suffix rather than losing the whole response.
 */
function uniqueTutorPlanStepId(id, usedIds) {
    if (!usedIds.has(id)) {
        usedIds.add(id);
        return id;
    }
    for (let suffix = 2; suffix < 100; suffix += 1) {
        const marker = `_${suffix}`;
        const candidate = id.slice(0, tutorPlanStepIdMaxLength - marker.length) + marker;
        if (!usedIds.has(candidate)) {
            usedIds.add(candidate);
            return candidate;
        }
    }
    return id;
}
function sanitizeTutorPlanBlock(record) {
    const steps = record.steps;
    if (!Array.isArray(steps)) {
        return record;
    }
    const usedIds = new Set();
    return {
        ...record,
        steps: steps.map((step) => {
            if (!step || typeof step !== 'object') {
                return step;
            }
            const id = slugifyTutorPlanStepId(step.id);
            if (typeof id !== 'string') {
                return step;
            }
            return { ...step, id: uniqueTutorPlanStepId(id, usedIds) };
        }),
    };
}
function sanitizeTutorPlanUpdateBlock(record) {
    const operations = record.operations;
    if (!Array.isArray(operations)) {
        return record;
    }
    return {
        ...record,
        operations: operations.map((operation) => {
            if (!operation || typeof operation !== 'object') {
                return operation;
            }
            const source = operation;
            const normalized = {
                ...source,
                id: slugifyTutorPlanStepId(source.id),
            };
            if (source.afterId !== undefined) {
                normalized.afterId = slugifyTutorPlanStepId(source.afterId);
            }
            return normalized;
        }),
    };
}
export function blocksToMarkdown(blocks, locale = defaultInstructionLanguage) {
    const messageMarkdown = blocks
        .filter(isVisibleTutorBlock)
        .map((block) => {
        if (block.type === 'sentence_evaluation') {
            return translate(locale, 'tutorBlocks.sentenceEvaluationIntro');
        }
        if (block.type === 'dialogue_character_message') {
            return `**${block.name}:** ${block.markdown.trim()}`;
        }
        if (block.type === 'dialogue_transcript') {
            return block.turns
                .map((turn) => `**${turn.speaker.trim()}:** ${turn.markdown.trim()}`)
                .join('\n\n');
        }
        if (block.type === 'matching_pairs') {
            return block.prompt?.trim() || translate(locale, 'tutorBlocks.matchingPairsFallback');
        }
        if (block.type === 'quiz') {
            return block.title?.trim() || block.prompt.trim();
        }
        if (block.type === 'quiz_result') {
            return (block.title?.trim() ||
                block.prompt?.trim() ||
                translate(locale, 'tutorBlocks.quizResultFallback'));
        }
        if (block.type === 'fill_in_the_blank_input' ||
            block.type === 'fill_in_the_blank_choice') {
            const sentencePreview = block.type === 'fill_in_the_blank_choice'
                ? block.sentence.trim().replaceAll('{{blank}}', '_____')
                : block.sentence.trim().replaceAll('___', '_____');
            return block.prompt?.trim() || sentencePreview;
        }
        if (block.type === 'multiple_choice') {
            return block.prompt?.trim() || block.question.trim();
        }
        if (block.type === 'unscramble_sentence') {
            return block.prompt?.trim() || block.tokens.join(' ').trim();
        }
        if (block.type === 'order_sentences') {
            return block.prompt?.trim() || translate(locale, 'tutorBlocks.orderSentencesFallback');
        }
        if (block.type === 'translate_to_english_prompt') {
            return translate(locale, 'tutorBlocks.translateToEnglishPrompt', {
                sentence: block.sentence.trim(),
            });
        }
        if (block.type === 'understand_in_spanish_prompt') {
            return translate(locale, 'tutorBlocks.understandInSpanishPrompt', {
                sentence: block.sentence.trim(),
            });
        }
        if (block.type === 'open_text_prompt') {
            return block.prompt.trim();
        }
        return block.markdown.trim();
    })
        .filter(Boolean);
    if (messageMarkdown.length > 0) {
        return messageMarkdown.join('\n\n');
    }
    return '';
}
//# sourceMappingURL=validation.js.map