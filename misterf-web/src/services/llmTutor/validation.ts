import type {
  TutorDialogueCharacterMessageBlock,
  TutorDialogueTranscriptBlock,
  TutorMatchingPairsBlock,
  TutorUnderstandInSpanishPromptBlock,
  TutorMessage,
  TutorMessageBlock,
  TutorResponseBlock,
  TutorTranslateToEnglishPromptBlock,
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
        | TutorDialogueCharacterMessageBlock
        | TutorDialogueTranscriptBlock
        | TutorMatchingPairsBlock
        | TutorTranslateToEnglishPromptBlock
        | TutorUnderstandInSpanishPromptBlock =>
        block.type === 'message' ||
        block.type === 'dialogue_character_message' ||
        block.type === 'dialogue_transcript' ||
        block.type === 'matching_pairs' ||
        block.type === 'translate_to_english_prompt' ||
        block.type === 'understand_in_spanish_prompt',
    )
    .map((block) => {
      if (block.type === 'dialogue_character_message') {
        return `**${block.name}:** ${block.markdown.trim()}`;
      }

      if (block.type === 'dialogue_transcript') {
        return block.turns
          .map((turn) => `**${turn.speaker.trim()}:** ${turn.markdown.trim()}`)
          .join('\n\n');
      }

      if (block.type === 'matching_pairs') {
        return block.prompt?.trim() || 'Ejercicio de emparejar.';
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

  return 'Listo.';
}
