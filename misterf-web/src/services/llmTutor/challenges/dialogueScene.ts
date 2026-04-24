import { z } from 'zod';

export const dialogueSceneChallengeStartedBlockSchema = z
  .object({
    type: z.literal('challenge_started'),
    challengeType: z.literal('dialogue_scene'),
    challengeLabel: z.string().trim().min(1).max(120),
    objective: z.string().trim().min(1).max(160).optional(),
    topic: z.string().trim().min(1).max(80).optional(),
    level: z.string().trim().min(1).max(40).optional(),
  })
  .strict();
