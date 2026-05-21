import { logJson } from './logging.js';
import { renderSystemPrompt } from '../systemPrompts.js';
export function appendStructuredCorrectionRequest(messages, input) {
    const invalidOutput = input.invalidOutput?.trim();
    if (invalidOutput) {
        messages.push({
            content: invalidOutput.slice(0, 6000),
            role: 'assistant',
        });
    }
    messages.push({
        content: renderSystemPrompt('tutor/structured-correction.md', {
            CORRECTION_REASON: input.reason,
        }),
        role: 'user',
    });
    logJson('[Mr. F LLM structured correction requested]', {
        error: serializeLlmError(input.error),
        hadInvalidOutput: Boolean(invalidOutput),
        reason: input.reason,
        turn: input.turn,
    });
}
export function buildStructuredValidationReason(error) {
    const baseReason = 'The JSON object was parsed, but it does not satisfy the TutorResponse contract.';
    const detail = error instanceof Error ? error.message.trim() : 'Unknown validation error.';
    return [baseReason, detail].join('\n');
}
export function isCorrectableLlmOutputError(error) {
    const text = JSON.stringify(serializeLlmError(error)).toLowerCase();
    return (text.includes('no object generated') ||
        text.includes('json parsing failed') ||
        text.includes('could not parse') ||
        text.includes('type validation') ||
        text.includes('invalid') ||
        text.includes('schema'));
}
export function extractGeneratedTextFromError(error) {
    if (!error || typeof error !== 'object') {
        return null;
    }
    const record = error;
    if (typeof record.text === 'string') {
        return record.text;
    }
    return extractGeneratedTextFromError(record.cause);
}
function serializeLlmError(error) {
    if (error instanceof Error) {
        return {
            cause: serializeLlmError(error.cause),
            message: error.message,
            name: error.name,
        };
    }
    if (error && typeof error === 'object') {
        const record = error;
        return {
            message: typeof record.message === 'string' ? record.message : undefined,
            name: typeof record.name === 'string' ? record.name : undefined,
            text: typeof record.text === 'string' ? record.text.slice(0, 6000) : undefined,
        };
    }
    return error;
}
//# sourceMappingURL=corrections.js.map