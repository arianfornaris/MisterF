import type {
  TutorDialogueCharacterMessageBlock,
  TutorDialogueTranscriptBlock,
  TutorFillInTheBlankChoiceBlock,
  TutorFillInTheBlankInputBlock,
  LlmRequestOptions,
  TutorPracticeGuideLinkBlock,
  TutorMatchingPairsBlock,
  TutorMultipleChoiceBlock,
  TutorAgentResponseBlock,
  TutorQuizBlock,
  TutorQuizResultBlock,
  TutorSentenceEvaluationBlock,
  TutorUnderstandInSpanishPromptBlock,
  TutorMessage,
  TutorMessageBlock,
  TutorOpenTextPromptBlock,
  TutorResponseBlock,
  TutorTranslateToEnglishPromptBlock,
  TutorUnscrambleSentenceBlock,
} from './types.js';
import { TutorResponseValidationError } from './errors.js';
import { logger } from '../logger.js';
import { shouldLogFullLlmTrace } from './logging.js';
import { tutorAgentResponseSchema } from './schemas.js';

export function toModelMessage(message: TutorMessage) {
  return {
    content: message.content,
    role: message.role === 'model' ? 'assistant' : 'user',
  } as const;
}

export function validateTutorResponseBlocks(
  value: unknown,
  options: {
    conversationId?: string | null;
    generatedText?: string | null;
    llm?: LlmRequestOptions;
    operation?: string;
    userId?: string | null;
  } = {},
): TutorAgentResponseBlock[] {
  const parsed = tutorAgentResponseSchema.safeParse(sanitizeTutorResponse(value));
  if (!parsed.success) {
    const fullTrace = shouldLogFullLlmTrace({
      conversationId: options.conversationId,
      userId: options.userId ?? options.llm?.userId ?? null,
    });
    logger.warn('llm_response_validation_failed', {
      conversationId: options.conversationId ?? null,
      fullTrace,
      issues: parsed.error.issues,
      operation: options.operation ?? 'tutor',
      userId: options.userId ?? options.llm?.userId ?? null,
      value: fullTrace ? value : undefined,
      valueSummary: summarizeInvalidTutorResponse(value),
    });
    throw new TutorResponseValidationError({
      generatedText: options.generatedText,
      issues: parsed.error.issues,
    });
  }

  return parsed.data.blocks as TutorAgentResponseBlock[];
}

function summarizeInvalidTutorResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return {
      type: value === null ? 'null' : typeof value,
    };
  }

  if (Array.isArray(value)) {
    return {
      itemCount: value.length,
      type: 'array',
    };
  }

  const record = value as { blocks?: unknown };
  return {
    blockCount: Array.isArray(record.blocks) ? record.blocks.length : null,
    keys: Object.keys(value),
    type: 'object',
  };
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
        | TutorPracticeGuideLinkBlock
        | TutorDialogueCharacterMessageBlock
        | TutorDialogueTranscriptBlock
        | TutorMatchingPairsBlock
        | TutorQuizBlock
        | TutorQuizResultBlock
        | TutorTranslateToEnglishPromptBlock
        | TutorUnderstandInSpanishPromptBlock
        | TutorOpenTextPromptBlock
        | TutorFillInTheBlankInputBlock
        | TutorFillInTheBlankChoiceBlock
        | TutorMultipleChoiceBlock
        | TutorUnscrambleSentenceBlock
        | TutorSentenceEvaluationBlock =>
        block.type === 'message' ||
        block.type === 'practice_guide_link' ||
        block.type === 'dialogue_character_message' ||
        block.type === 'dialogue_transcript' ||
        block.type === 'matching_pairs' ||
        block.type === 'quiz' ||
        block.type === 'quiz_result' ||
        block.type === 'translate_to_english_prompt' ||
        block.type === 'understand_in_spanish_prompt' ||
        block.type === 'open_text_prompt' ||
        block.type === 'fill_in_the_blank_input' ||
        block.type === 'fill_in_the_blank_choice' ||
        block.type === 'multiple_choice' ||
        block.type === 'unscramble_sentence' ||
        block.type === 'sentence_evaluation',
    )
    .map((block) => {
      if (block.type === 'sentence_evaluation') {
        return 'Revisemos esta parte:';
      }

      if (block.type === 'dialogue_character_message') {
        return `**${block.name}:** ${block.markdown.trim()}`;
      }

      if (block.type === 'practice_guide_link') {
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

      if (block.type === 'open_text_prompt') {
        return block.prompt.trim();
      }

      return block.markdown.trim();
    })
    .filter(Boolean);

  if (messageMarkdown.length > 0) {
    return messageMarkdown.join('\n\n');
  }

  return '';
}
