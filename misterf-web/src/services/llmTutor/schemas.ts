import { z } from 'zod';
import { dialogueSceneChallengeStartedBlockSchema } from './challenges/dialogueScene.js';
import { produceEnChallengeStartedBlockSchema } from './challenges/produceEn.js';
import { understandEnChallengeStartedBlockSchema } from './challenges/understandEn.js';

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

export const challengeStartedBlockSchema = z.union([
  produceEnChallengeStartedBlockSchema,
  understandEnChallengeStartedBlockSchema,
  dialogueSceneChallengeStartedBlockSchema,
]);

export const characterMessageBlockSchema = z
  .object({
    type: z.literal('character_message'),
    name: z.string().trim().min(1).max(80),
    markdown: z.string().trim().min(1).max(1400),
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

export const challengeCompletedBlockSchema = z
  .object({
    type: z.literal('challenge_completed'),
    score: z
      .number()
      .nonnegative()
      .max(100)
      .transform((score) => (score > 1 ? score / 100 : score))
      .pipe(z.number().min(0).max(1)),
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
          challengeStartedBlockSchema,
          characterMessageBlockSchema,
          sentenceEvaluationBlockSchema,
          challengeCompletedBlockSchema,
          conversationTitleBlockSchema,
        ]),
      )
      .min(1)
      .max(8),
  })
  .strict();
