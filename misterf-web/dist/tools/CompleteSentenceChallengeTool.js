import { completeSentenceChallenge, findActiveSentenceChallenge, listSentenceChallenges, } from '../db/repository.js';
export class CompleteSentenceChallengeTool {
    name = 'complete_sentence_challenge';
    declaration = {
        name: this.name,
        description: 'Marca como completado el reto activo cuando el usuario finalmente escribe correctamente la oración en inglés. OBLIGATORIA después de llamar update_sentence_evaluation cuando todas las partes del intento actual tengan status "correct", y antes de proponer otra oración. NO USAR si todavía hay partes con status "error" o "improve", si el usuario solo hizo una pregunta lateral, si no hay reto activo o si aún no evaluaste el intento con update_sentence_evaluation. Recibe únicamente un score.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                score: {
                    type: 'number',
                    description: 'Puntuación del intento final entre 0 y 1. Usa 1 para una respuesta perfecta, 0.85-0.95 para una respuesta correcta con detalles menores de estilo o puntuación.',
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ['score'],
        },
    };
    execute(call, context) {
        const score = normalizeScore(call.args.score);
        if (score === null) {
            return { ok: false, error: 'Invalid completion score.' };
        }
        const activeChallenge = findActiveSentenceChallenge(context.conversationId);
        const challenges = listSentenceChallenges(context.conversationId);
        const challengeForLastUserAttempt = context.lastUserMessageId
            ? challenges.find((challenge) => challenge.attempts.some((attempt) => attempt.userMessageId === context.lastUserMessageId))
            : null;
        const latestIncompleteChallengeWithAttempts = [...challenges]
            .reverse()
            .find((challenge) => !challenge.completedAt && challenge.attempts.length > 0);
        const challengeToComplete = challengeForLastUserAttempt ??
            latestIncompleteChallengeWithAttempts ??
            activeChallenge ??
            [...challenges]
                .reverse()
                .find((challenge) => challenge.completedAt);
        if (!challengeToComplete) {
            return {
                ok: false,
                error: 'No active sentence challenge is available to complete.',
            };
        }
        const challenge = completeSentenceChallenge(challengeToComplete.id, context.conversationId, score);
        context.io.to(context.conversationId).emit('practice:updated', {
            challenges: listSentenceChallenges(context.conversationId),
            conversationId: context.conversationId,
        });
        const completionPayload = {
            automatic: false,
            challenge,
            conversationId: context.conversationId,
            score,
            source: this.name,
            targetReason: getTargetReason({
                activeChallengeId: activeChallenge?.id ?? null,
                challengeForLastUserAttemptId: challengeForLastUserAttempt?.id ?? null,
                challengeToCompleteId: challengeToComplete.id,
                latestIncompleteChallengeWithAttemptsId: latestIncompleteChallengeWithAttempts?.id ?? null,
            }),
        };
        console.log('[Mr. F confetti emit]', completionPayload);
        context.io
            .to(context.conversationId)
            .emit('sentence_challenge:completed', completionPayload);
        return {
            challenge,
            ok: true,
            score,
        };
    }
}
function normalizeScore(value) {
    const score = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(score)) {
        return null;
    }
    return Math.min(1, Math.max(0, score));
}
function getTargetReason(input) {
    if (input.challengeForLastUserAttemptId === input.challengeToCompleteId) {
        return 'last_user_attempt';
    }
    if (input.latestIncompleteChallengeWithAttemptsId === input.challengeToCompleteId) {
        return 'latest_incomplete_with_attempts';
    }
    if (input.activeChallengeId === input.challengeToCompleteId) {
        return 'active_challenge';
    }
    return 'latest_completed_challenge';
}
//# sourceMappingURL=CompleteSentenceChallengeTool.js.map