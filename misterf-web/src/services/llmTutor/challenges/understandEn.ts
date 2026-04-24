import { z } from 'zod';

export const understandEnChallengeStartedBlockSchema = z
  .object({
    type: z.literal('challenge_started'),
    challengeType: z.literal('understand_en'),
    challengeLabel: z.string().trim().min(1).max(320),
    objective: z.string().trim().min(1).max(160).optional(),
    topic: z.string().trim().min(1).max(80).optional(),
    level: z.string().trim().min(1).max(40).optional(),
  })
  .strict();
