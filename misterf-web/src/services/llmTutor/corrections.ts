import type { ModelMessage } from 'ai';
import { logJson } from './logging.js';

export function appendStructuredCorrectionRequest(
  messages: ModelMessage[],
  input: {
    error: unknown;
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
    content: [
      'INTERNAL APP CONTINUATION.',
      '',
      input.reason,
      'Do not respond with explanations, apologies, loose markdown, or any text before or after the JSON object.',
      'Re-emit the complete response as one JSON object that exactly satisfies the TutorResponse contract.',
      'The only valid block types are: message, lesson_link, call_secretary, dialogue_character_message, dialogue_transcript, matching_pairs, quiz, translate_to_english_prompt, understand_in_spanish_prompt, fill_in_the_blank_input, fill_in_the_blank_choice, multiple_choice, unscramble_sentence, sentence_evaluation, conversation_title.',
    ].join('\n'),
    role: 'user',
  });

  logJson('[Mr. F LLM structured correction requested]', {
    error: serializeLlmError(input.error),
    hadInvalidOutput: Boolean(invalidOutput),
    reason: input.reason,
    turn: input.turn,
  });
}

export function buildStructuredValidationReason(error: unknown): string {
  const baseReason =
    'The JSON object was parsed, but it does not satisfy the TutorResponse contract.';
  const detail =
    error instanceof Error ? error.message.trim() : 'Unknown validation error.';

  return [baseReason, detail].join('\n');
}

export function isCorrectableLlmOutputError(error: unknown): boolean {
  const text = JSON.stringify(serializeLlmError(error)).toLowerCase();
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
  if (!error || typeof error !== 'object') {
    return null;
  }

  const record = error as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }

  return extractGeneratedTextFromError(record.cause);
}

function serializeLlmError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      cause: serializeLlmError(error.cause),
      message: error.message,
      name: error.name,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === 'string' ? record.message : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      text: typeof record.text === 'string' ? record.text.slice(0, 6000) : undefined,
    };
  }

  return error;
}
