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
    detectedLanguage: z.string().trim().min(1).max(80),
    translatedText: z.string().trim().min(1).max(3000),
  })
  .strict();

export const vocabularyItemSchema = z
  .object({
    term: z.string().trim().min(1).max(90),
    translation: z.string().trim().min(1).max(160),
    explanation: z.string().trim().min(1).max(360),
    example: z.string().trim().min(1).max(240).optional(),
    sourceSentence: z.string().trim().min(1).max(320).optional(),
  })
  .strict();

export const messageBlockSchema = z
  .object({
    type: z.literal('message'),
    markdown: z.string().trim().min(1).max(2400),
  })
  .strict();

export const dialogueCharacterMessageBlockSchema = z
  .object({
    type: z.literal('dialogue_character_message'),
    name: z.string().trim().min(1).max(80),
    markdown: z.string().trim().min(1).max(1400),
  })
  .strict();

export const dialogueTranscriptBlockSchema = z
  .object({
    type: z.literal('dialogue_transcript'),
    turns: z
      .array(
        z
          .object({
            speaker: z.string().trim().min(1).max(80),
            markdown: z.string().trim().min(1).max(1400),
          })
          .strict(),
      )
      .min(2)
      .max(24),
  })
  .strict();

export const matchingPairsBlockSchema = z
  .object({
    type: z.literal('matching_pairs'),
    prompt: z.string().trim().min(1).max(500).optional(),
    leftItems: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(80),
            text: z.string().trim().min(1).max(280),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    rightItems: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(80),
            text: z.string().trim().min(1).max(280),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    correctPairs: z
      .array(
        z
          .object({
            leftId: z.string().trim().min(1).max(80),
            rightId: z.string().trim().min(1).max(80),
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict()
  .refine((block) => block.leftItems.length === block.rightItems.length, {
    message: 'leftItems and rightItems must have the same length.',
    path: ['rightItems'],
  })
  .refine((block) => block.correctPairs.length === block.leftItems.length, {
    message: 'correctPairs must match the number of leftItems.',
    path: ['correctPairs'],
  });

export const translateToEnglishPromptBlockSchema = z
  .object({
    type: z.literal('translate_to_english_prompt'),
    sentence: z.string().trim().min(1).max(800),
  })
  .strict();

export const understandInSpanishPromptBlockSchema = z
  .object({
    type: z.literal('understand_in_spanish_prompt'),
    sentence: z.string().trim().min(1).max(800),
  })
  .strict();

export const sentenceEvaluationBlockSchema = z
  .object({
    type: z.literal('sentence_evaluation'),
    parts: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(1200),
            status: z.enum(['correct', 'improve', 'error']),
            explanation: z.string().trim().max(320).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict();

export const conversationTitleBlockSchema = z
  .object({
    type: z.literal('conversation_title'),
    title: z.string().trim().min(1).max(90),
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
          sentenceEvaluationBlockSchema,
          conversationTitleBlockSchema,
        ]),
      )
      .min(1)
      .max(8),
  })
  .strict();
