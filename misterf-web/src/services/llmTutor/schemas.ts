import { z } from 'zod';

export const genericTutorResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blocks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
  required: ['blocks'],
} as const;

export const translationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detectedLanguage: {
      type: 'string',
    },
    translatedText: {
      type: 'string',
    },
  },
  required: ['detectedLanguage', 'translatedText'],
} as const;

export const translationResultSchema = z
  .object({
    detectedLanguage: z.string().trim().min(1).max(160),
    translatedText: z.string().trim().min(1).max(8000),
  })
  .strict();

export const messageBlockSchema = z
  .object({
    type: z.literal('message'),
    markdown: z.string().trim().min(1).max(5000),
  })
  .strict();

export const dialogueCharacterMessageBlockSchema = z
  .object({
    type: z.literal('dialogue_character_message'),
    name: z.string().trim().min(1).max(120),
    markdown: z.string().trim().min(1).max(3000),
  })
  .strict();

export const dialogueTranscriptBlockSchema = z
  .object({
    type: z.literal('dialogue_transcript'),
    turns: z
      .array(
        z
          .object({
            speaker: z.string().trim().min(1).max(120),
            markdown: z.string().trim().min(1).max(3000),
          })
          .strict(),
      )
      .min(2)
      .max(40),
  })
  .strict();

export const matchingPairsBlockSchema = z
  .object({
    type: z.literal('matching_pairs'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    pairs: z
      .array(
        z
          .object({
            left: z.string().trim().min(1).max(600),
            right: z.string().trim().min(1).max(600),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();

export const fillInTheBlankInputBlockSchema = z
  .object({
    type: z.literal('fill_in_the_blank_input'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    sentence: z.string().trim().min(1).max(1600),
    blanks: z
      .array(
        z
          .object({
            answers: z.array(z.string().trim().min(1).max(240)).min(1).max(16),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine((block) => countSentencePlaceholders(block.sentence, '___') === block.blanks.length, {
    message: 'sentence must contain exactly one ___ placeholder per blanks entry.',
    path: ['sentence'],
  });

export const fillInTheBlankChoiceBlockSchema = z
  .object({
    type: z.literal('fill_in_the_blank_choice'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    sentence: z.string().trim().min(1).max(1600),
    blanks: z
      .array(
        z
          .object({
            choices: z.array(z.string().trim().min(1).max(240)).min(2).max(20),
            answers: z.array(z.string().trim().min(1).max(240)).min(1).max(16),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine((block) => countSentencePlaceholders(block.sentence, '{{blank}}') === block.blanks.length, {
    message: 'sentence must contain exactly one {{blank}} placeholder per blanks entry.',
    path: ['sentence'],
  });

export const multipleChoiceBlockSchema = z
  .object({
    type: z.literal('multiple_choice'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    question: z.string().trim().min(1).max(1600),
    selectionMode: z.enum(['single', 'multiple']),
    options: z
      .array(
        z
          .object({
            isCorrect: z.boolean(),
            text: z.string().trim().min(1).max(400),
          })
          .strict(),
      )
      .min(2)
      .max(16),
  })
  .strict()
  .refine((block) => block.options.some((option) => option.isCorrect), {
    message: 'multiple_choice must include at least one correct option.',
    path: ['options'],
  })
  .refine((block) => {
    if (block.selectionMode === 'multiple') {
      return true;
    }

    return block.options.filter((option) => option.isCorrect).length === 1;
  }, {
    message:
      'multiple_choice with selectionMode "single" must include exactly one correct option.',
    path: ['selectionMode'],
  });

export const unscrambleSentenceBlockSchema = z
  .object({
    type: z.literal('unscramble_sentence'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    tokens: z.array(z.string().trim().min(1).max(120)).min(2).max(32),
    answers: z.array(z.string().trim().min(1).max(1600)).min(1).max(12),
  })
  .strict();

export const translateToEnglishPromptBlockSchema = z
  .object({
    type: z.literal('translate_to_english_prompt'),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict();

function countSentencePlaceholders(sentence: string, placeholder: string): number {
  if (!placeholder) {
    return 0;
  }

  return sentence.split(placeholder).length - 1;
}

export const understandInSpanishPromptBlockSchema = z
  .object({
    type: z.literal('understand_in_spanish_prompt'),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict();

export const sentenceEvaluationBlockSchema = z
  .object({
    type: z.literal('sentence_evaluation'),
    parts: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(2400),
            status: z.enum(['correct', 'improve', 'error']),
            explanation: z.string().trim().max(800).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict();

export const conversationTitleBlockSchema = z
  .object({
    type: z.literal('conversation_title'),
    title: z.string().trim().min(1).max(160),
  })
  .strict();

export const tutorResponseSchema = z
  .object({
    blocks: z
      .array(
        z.union([
          messageBlockSchema,
          dialogueCharacterMessageBlockSchema,
          dialogueTranscriptBlockSchema,
          matchingPairsBlockSchema,
          translateToEnglishPromptBlockSchema,
          understandInSpanishPromptBlockSchema,
          fillInTheBlankInputBlockSchema,
          fillInTheBlankChoiceBlockSchema,
          multipleChoiceBlockSchema,
          unscrambleSentenceBlockSchema,
          sentenceEvaluationBlockSchema,
          conversationTitleBlockSchema,
        ]),
      )
      .min(1)
      .max(16),
  })
  .strict();
