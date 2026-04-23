import type { FinishReason } from 'ai';

export class MissingLlmApiKeyError extends Error {
  constructor(readonly provider: string) {
    super(`Missing API key for LLM provider: ${provider}.`);
    this.name = 'MissingLlmApiKeyError';
  }
}

export class LlmFinishReasonError extends Error {
  constructor(
    readonly finishReason: FinishReason | string,
    message: string,
  ) {
    super(message);
    this.name = 'LlmFinishReasonError';
  }
}
