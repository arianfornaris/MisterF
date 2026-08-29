import type { ModelMessage } from 'ai';
import { logger } from '../logger.js';
import { shouldLogFullLlmTrace } from './logging.js';
import { renderSystemPrompt } from '../systemPrompts.js';
import { TutorResponseValidationError } from './errors.js';
import { renderTutorBlockProtocol } from './blockProtocol.js';
import {
  defaultInstructionLanguage,
  type InstructionLanguage,
} from './languagePack.js';

export function appendStructuredCorrectionRequest(
  messages: ModelMessage[],
  input: {
    error: unknown;
    instructionLanguage?: InstructionLanguage;
    invalidOutput?: string | null;
    reason: string;
    turn: number;
  },
): void {
  const invalidOutput = input.invalidOutput?.trim();

  if (invalidOutput) {
    messages.push({
      content: invalidOutput.slice(0, 6000),
      role: 'assistant',
    });
  }

  messages.push({
    content: renderSystemPrompt('tutor/structured-correction.md', {
      BLOCK_PROTOCOL: renderTutorBlockProtocol(
        undefined,
        input.instructionLanguage ?? defaultInstructionLanguage,
      ),
      CORRECTION_REASON: input.reason,
    }),
    role: 'user',
  });

  const fullTrace = shouldLogFullLlmTrace();
  logger.info('llm_structured_correction_requested', {
    error: serializeLlmError(input.error, fullTrace),
    fullTrace,
    hadInvalidOutput: Boolean(invalidOutput),
    invalidOutputLength: invalidOutput?.length ?? 0,
    reason: input.reason,
    turn: input.turn,
  });
}

/**
 * Reason sent back to the model on a correction turn. A schema failure must
 * name the offending paths: told only that "something" was invalid, a small
 * model re-emits the same output until the agent loop runs out of turns.
 */
export function buildStructuredCorrectionReason(error: unknown): string {
  if (error instanceof TutorResponseValidationError) {
    return buildStructuredValidationReason(error);
  }

  return 'Your previous response was not valid JSON or could not be converted into a TutorResponse object.';
}

export function buildStructuredValidationReason(error: unknown): string {
  const baseReason =
    'The JSON object was parsed, but it does not satisfy the TutorResponse contract.';
  const detail = buildStructuredValidationDetail(error);

  return [baseReason, detail].join('\n');
}

export function isCorrectableLlmOutputError(error: unknown): boolean {
  if (error instanceof TutorResponseValidationError) {
    return true;
  }

  const text = JSON.stringify(serializeLlmError(error, true)).toLowerCase();
  return (
    text.includes('no object generated') ||
    text.includes('json parsing failed') ||
    text.includes('could not parse') ||
    text.includes('type validation') ||
    text.includes('invalid') ||
    text.includes('schema')
  );
}

export function extractGeneratedTextFromError(error: unknown): string | null {
  if (error instanceof TutorResponseValidationError) {
    return error.generatedText;
  }

  if (!error || typeof error !== 'object') {
    return null;
  }

  const record = error as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }

  return extractGeneratedTextFromError(record.cause);
}

function serializeLlmError(error: unknown, includeGeneratedText: boolean): unknown {
  if (error instanceof TutorResponseValidationError) {
    return {
      generatedText: includeGeneratedText
        ? error.generatedText?.slice(0, 6000)
        : undefined,
      issues: error.issues,
      message: error.message,
      name: error.name,
    };
  }

  if (error instanceof Error) {
    return {
      cause: serializeLlmError(error.cause, includeGeneratedText),
      message: error.message,
      name: error.name,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === 'string' ? record.message : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      text:
        includeGeneratedText && typeof record.text === 'string'
          ? record.text.slice(0, 6000)
          : undefined,
    };
  }

  return error;
}

function buildStructuredValidationDetail(error: unknown): string {
  if (error instanceof TutorResponseValidationError) {
    if (error.issues.length === 0) {
      return error.message.trim();
    }

    return [
      'Fix the invalid parts and re-emit the full TutorResponse JSON.',
      ...error.issues.map((issue, index) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `${index + 1}. path=${path} :: ${issue.message}`;
      }),
    ].join('\n');
  }

  return error instanceof Error ? error.message.trim() : 'Unknown validation error.';
}
