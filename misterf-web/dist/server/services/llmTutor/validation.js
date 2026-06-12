import { TutorResponseValidationError } from './errors.js';
import { tutorAgentResponseSchema } from './schemas.js';
export function toModelMessage(message) {
    return {
        content: message.content,
        role: message.role === 'model' ? 'assistant' : 'user',
    };
}
export function validateTutorResponseBlocks(value, options = {}) {
    const parsed = tutorAgentResponseSchema.safeParse(sanitizeTutorResponse(value));
    if (!parsed.success) {
        console.error('[Mr. F LLM response validation failed]', JSON.stringify({
            issues: parsed.error.issues,
            value,
        }, null, 2));
        throw new TutorResponseValidationError({
            generatedText: options.generatedText,
            issues: parsed.error.issues,
        });
    }
    return parsed.data.blocks;
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
export function blocksToMarkdown(blocks) {
    const messageMarkdown = blocks
        .filter((block) => block.type === 'message' ||
        block.type === 'practice_module_link' ||
        block.type === 'dialogue_character_message' ||
        block.type === 'dialogue_transcript' ||
        block.type === 'direction_choice' ||
        block.type === 'matching_pairs' ||
        block.type === 'quiz' ||
        block.type === 'quiz_result' ||
        block.type === 'translate_to_english_prompt' ||
        block.type === 'understand_in_spanish_prompt' ||
        block.type === 'fill_in_the_blank_input' ||
        block.type === 'fill_in_the_blank_choice' ||
        block.type === 'multiple_choice' ||
        block.type === 'unscramble_sentence' ||
        block.type === 'sentence_evaluation')
        .map((block) => {
        if (block.type === 'sentence_evaluation') {
            return 'Revisemos esta parte:';
        }
        if (block.type === 'dialogue_character_message') {
            return `**${block.name}:** ${block.markdown.trim()}`;
        }
        if (block.type === 'practice_module_link') {
            return block.label.trim();
        }
        if (block.type === 'dialogue_transcript') {
            return block.turns
                .map((turn) => `**${turn.speaker.trim()}:** ${turn.markdown.trim()}`)
                .join('\n\n');
        }
        if (block.type === 'direction_choice') {
            const options = block.options
                .map((option, index) => {
                const label = option.label.trim();
                const description = option.description?.trim();
                const prefix = `${String.fromCharCode(65 + index)}.`;
                return description
                    ? `${prefix} ${label} - ${description}`
                    : `${prefix} ${label}`;
            })
                .join('\n');
            return `${block.prompt.trim()}\n${options}`.trim();
        }
        if (block.type === 'matching_pairs') {
            return block.prompt?.trim() || 'Ejercicio de emparejar.';
        }
        if (block.type === 'quiz') {
            return block.title?.trim() || block.prompt.trim();
        }
        if (block.type === 'quiz_result') {
            return block.title?.trim() || block.prompt?.trim() || 'Resumen del quiz';
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
        if (block.type === 'translate_to_english_prompt') {
            return `Traduce al ingles: "${block.sentence.trim()}"`;
        }
        if (block.type === 'understand_in_spanish_prompt') {
            return `Explica en espanol: "${block.sentence.trim()}"`;
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