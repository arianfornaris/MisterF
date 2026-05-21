import { z } from 'zod';
export const produceEnChallengeStartedBlockSchema = z
    .object({
    type: z.literal('challenge_started'),
    challengeType: z.literal('produce_en').optional(),
    challengeLabel: z.string().trim().min(1).max(320),
    objective: z.string().trim().min(1).max(160).optional(),
    topic: z.string().trim().min(1).max(80).optional(),
    level: z.string().trim().min(1).max(40).optional(),
})
    .strict();
//# sourceMappingURL=produceEn.js.map