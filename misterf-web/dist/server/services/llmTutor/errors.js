export class MissingLlmApiKeyError extends Error {
    provider;
    constructor(provider) {
        super(`Missing API key for LLM provider: ${provider}.`);
        this.provider = provider;
        this.name = 'MissingLlmApiKeyError';
    }
}
export class LlmFinishReasonError extends Error {
    finishReason;
    constructor(finishReason, message) {
        super(message);
        this.finishReason = finishReason;
        this.name = 'LlmFinishReasonError';
    }
}
export class TutorResponseValidationError extends Error {
    issues;
    generatedText;
    constructor(input) {
        super(input.message ??
            'El modelo no devolvió una respuesta estructurada válida. Intenta de nuevo en unos segundos.');
        this.name = 'TutorResponseValidationError';
        this.issues = input.issues;
        this.generatedText = input.generatedText?.trim() || null;
    }
}
export class QuizResultEvaluationValidationError extends Error {
    issues;
    generatedText;
    constructor(input) {
        super(input.message ??
            'El evaluador del quiz no devolvió una respuesta válida.');
        this.name = 'QuizResultEvaluationValidationError';
        this.issues = input.issues;
        this.generatedText = input.generatedText?.trim() || null;
    }
}
//# sourceMappingURL=errors.js.map