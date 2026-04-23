import { z } from 'zod';

export const dialogueDefinitionSchema = z
  .object({
    scenario: z.string().trim().min(1).max(220),
    learnerRole: z.string().trim().min(1).max(100),
    characterName: z.string().trim().min(1).max(80),
    characterRole: z.string().trim().min(1).max(100),
    goals: z.array(z.string().trim().min(1).max(160)).min(2).max(4),
  })
  .strict();

export const dialogueSceneChallengeStartedBlockSchema = z
  .object({
    type: z.literal('challenge_started'),
    challengeType: z.literal('dialogue_scene'),
    dialogue: dialogueDefinitionSchema,
    objective: z.string().trim().min(1).max(160).optional(),
    topic: z.string().trim().min(1).max(80).optional(),
    level: z.string().trim().min(1).max(40).optional(),
  })
  .strict();
