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
//# sourceMappingURL=errors.js.map