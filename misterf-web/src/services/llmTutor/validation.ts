import type {
  TutorAdministrationInstructionBlock,
  TutorDialogueCharacterMessageBlock,
  TutorDialogueTranscriptBlock,
  TutorFillInTheBlankChoiceBlock,
  TutorFillInTheBlankInputBlock,
  TutorLessonLinkBlock,
  TutorMatchingPairsBlock,
  TutorMultipleChoiceBlock,
  TutorQuizBlock,
  TutorUnderstandInSpanishPromptBlock,
  TutorMessage,
  TutorMessageBlock,
  TutorResponseBlock,
  TutorTranslateToEnglishPromptBlock,
  TutorUnscrambleSentenceBlock,
} from './types.js';
import { tutorResponseSchema } from './schemas.js';

export function toModelMessage(message: TutorMessage) {
  return {
    content: message.content,
    role: message.role === 'model' ? 'assistant' : 'user',
  } as const;
}

export function validateTutorResponseBlocks(value: unknown): TutorResponseBlock[] {
  const parsed = tutorResponseSchema.safeParse(value);
  if (!parsed.success) {
    console.error('[Mr. F LLM response validation failed]', JSON.stringify({
      issues: parsed.error.issues,
      value,
    }, null, 2));
    throw new Error(
      'El modelo no devolvió una respuesta estructurada válida. Intenta de nuevo en unos segundos.',
    );
  }

  return parsed.data.blocks as TutorResponseBlock[];
}

export function blocksToMarkdown(blocks: TutorResponseBlock[]): string {
  const messageMarkdown = blocks
    .filter(
      (
        block,
      ): block is
        | TutorMessageBlock
        | TutorLessonLinkBlock
        | TutorAdministrationInstructionBlock
        | TutorDialogueCharacterMessageBlock
        | TutorDialogueTranscriptBlock
        | TutorMatchingPairsBlock
        | TutorQuizBlock
        | TutorTranslateToEnglishPromptBlock
        | TutorUnderstandInSpanishPromptBlock
        | TutorFillInTheBlankInputBlock
        | TutorFillInTheBlankChoiceBlock
        | TutorMultipleChoiceBlock
        | TutorUnscrambleSentenceBlock =>
        block.type === 'message' ||
        block.type === 'lesson_link' ||
        block.type === 'instructions_for_administration' ||
        block.type === 'dialogue_character_message' ||
        block.type === 'dialogue_transcript' ||
        block.type === 'matching_pairs' ||
        block.type === 'quiz' ||
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

      if (block.type === 'lesson_link') {
        return block.label.trim();
      }

      if (block.type === 'instructions_for_administration') {
        return '';
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
