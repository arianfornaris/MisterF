import type { FinishReason } from 'ai';
import type { ZodIssue } from 'zod';

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

export class TutorResponseValidationError extends Error {
  readonly issues: ZodIssue[];
  readonly generatedText: string | null;

  constructor(input: {
    issues: ZodIssue[];
    generatedText?: string | null;
    message?: string;
  }) {
    super(
      input.message ??
        'El modelo no devolvió una respuesta estructurada válida. Intenta de nuevo en unos segundos.',
    );
    this.name = 'TutorResponseValidationError';
    this.issues = input.issues;
    this.generatedText = input.generatedText?.trim() || null;
  }
}

export class QuizResultEvaluationValidationError extends Error {
  readonly issues: ZodIssue[];
  readonly generatedText: string | null;

  constructor(input: {
    issues: ZodIssue[];
    generatedText?: string | null;
    message?: string;
  }) {
    super(
      input.message ??
        'El evaluador del quiz no devolvió una respuesta válida.',
    );
    this.name = 'QuizResultEvaluationValidationError';
    this.issues = input.issues;
    this.generatedText = input.generatedText?.trim() || null;
  }
}
