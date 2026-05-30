import type {
  TutorDialogueCharacterMessageBlock,
  TutorDialogueTranscriptBlock,
  TutorFillInTheBlankChoiceBlock,
  TutorFillInTheBlankInputBlock,
  TutorPracticeModuleLinkBlock,
  TutorMatchingPairsBlock,
  TutorMultipleChoiceBlock,
  TutorQuizBlock,
  TutorQuizResultBlock,
  TutorUnderstandInSpanishPromptBlock,
  TutorMessage,
  TutorMessageBlock,
  TutorResponseBlock,
  TutorTranslateToEnglishPromptBlock,
  TutorUnscrambleSentenceBlock,
} from './types.js';
import { TutorResponseValidationError } from './errors.js';
import { tutorResponseSchema } from './schemas.js';

export function toModelMessage(message: TutorMessage) {
  return {
    content: message.content,
    role: message.role === 'model' ? 'assistant' : 'user',
  } as const;
}

export function validateTutorResponseBlocks(
  value: unknown,
  options: { generatedText?: string | null } = {},
): TutorResponseBlock[] {
  const parsed = tutorResponseSchema.safeParse(sanitizeTutorResponse(value));
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

  return parsed.data.blocks as TutorResponseBlock[];
}

function sanitizeTutorResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as { blocks?: unknown };
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

function sanitizeTutorResponseBlock(block: unknown): unknown | null {
  if (!block || typeof block !== 'object') {
    return block;
  }

  const record = block as { type?: unknown; parts?: unknown };
  if (record.type !== 'sentence_evaluation' || !Array.isArray(record.parts)) {
    return block;
  }

  const cleanedParts = record.parts.filter((part) => {
    if (!part || typeof part !== 'object') {
      return false;
    }

    const text = (part as { text?: unknown }).text;
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

export function blocksToMarkdown(blocks: TutorResponseBlock[]): string {
  const messageMarkdown = blocks
    .filter(
      (
        block,
      ): block is
        | TutorMessageBlock
        | TutorPracticeModuleLinkBlock
        | TutorDialogueCharacterMessageBlock
        | TutorDialogueTranscriptBlock
        | TutorMatchingPairsBlock
        | TutorQuizBlock
        | TutorQuizResultBlock
        | TutorTranslateToEnglishPromptBlock
        | TutorUnderstandInSpanishPromptBlock
        | TutorFillInTheBlankInputBlock
        | TutorFillInTheBlankChoiceBlock
        | TutorMultipleChoiceBlock
        | TutorUnscrambleSentenceBlock =>
        block.type === 'message' ||
        block.type === 'practice_module_link' ||
        block.type === 'dialogue_character_message' ||
        block.type === 'dialogue_transcript' ||
        block.type === 'matching_pairs' ||
        block.type === 'quiz' ||
        block.type === 'quiz_result' ||
        block.type === 'translate_to_english_prompt' ||
        block.type === 'understand_in_spanish_prompt' ||
        block.type === 'fill_in_the_blank_input' ||
        block.type === 'fill_in_the_blank_choice' ||
        block.type === 'multiple_choice' ||
        block.type === 'unscramble_sentence',
    )
    .map((block) => {
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

      if (block.type === 'matching_pairs') {
        return block.prompt?.trim() || 'Ejercicio de emparejar.';
      }

      if (block.type === 'quiz') {
        return block.title?.trim() || block.prompt.trim();
      }

      if (block.type === 'quiz_result') {
        return block.title?.trim() || block.prompt?.trim() || 'Resumen del quiz';
      }

      if (
        block.type === 'fill_in_the_blank_input' ||
        block.type === 'fill_in_the_blank_choice'
      ) {
        const sentencePreview =
          block.type === 'fill_in_the_blank_choice'
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
