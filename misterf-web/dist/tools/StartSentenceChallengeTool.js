import { createSentenceChallenge, findActiveSentenceChallenge, listSentenceChallenges, } from '../db/repository.js';
export class StartSentenceChallengeTool {
    name = 'start_sentence_challenge';
    declaration = {
        name: this.name,
        description: 'Registra la oración en español que el usuario debe traducir al inglés. OBLIGATORIA cuando propongas una nueva oración en español para traducir, antes o junto con tu mensaje normal al usuario. Úsala cuando no haya una oración activa pendiente. Después de una evaluación completamente correcta, lo ideal es esperar la CONTINUACION INTERNA DE LA APP para proponer la siguiente oración. NO USAR para saludos, preguntas de tema o nivel, explicaciones, pistas, feedback sobre un intento, traducciones esperadas ni conversación lateral. No registres la misma oración dos veces.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                sourceSentence: {
                    type: 'string',
                    description: 'La oración exacta en español que el usuario debe traducir.',
                },
                topic: {
                    type: 'string',
                    description: 'Tema breve de la oración, en español. Opcional si todavía no está claro.',
                },
                level: {
                    type: 'string',
                    description: 'Nivel de dificultad: principiante, intermedio o avanzado. Opcional.',
                },
            },
            required: ['sourceSentence'],
        },
    };
    execute(call, context) {
        const input = normalizeSentenceChallengeInput(call.args);
        if (!input) {
            return { ok: false, error: 'Invalid sentence challenge payload.' };
        }
        const current = findActiveSentenceChallenge(context.conversationId);
        if (current && current.sourceSentence === input.sourceSentence) {
            return { challenge: current, ok: true, skipped: true };
        }
        if (current) {
            return {
                challenge: current,
                error: 'Cannot start a new challenge while another sentence is still active. Evaluate the user attempt with update_sentence_evaluation and only move on when every part is correct.',
                ok: false,
            };
        }
        const challenge = createSentenceChallenge({
            conversationId: context.conversationId,
            level: input.level,
            sourceSentence: input.sourceSentence,
            topic: input.topic,
        });
        if (context.turnState) {
            context.turnState.challengeStartedThisTurn = true;
        }
        const challenges = listSentenceChallenges(context.conversationId);
        context.io.to(context.conversationId).emit('practice:updated', {
            challenges,
            conversationId: context.conversationId,
        });
        return { challenge, ok: true };
    }
}
function normalizeSentenceChallengeInput(args) {
    const sourceSentence = normalizeLongText(args.sourceSentence, 320);
    if (!sourceSentence) {
        return null;
    }
    return {
        level: normalizeShortText(args.level),
        sourceSentence,
        topic: normalizeShortText(args.topic),
    };
}
function normalizeShortText(value) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, 80)
        : '';
}
function normalizeLongText(value, maxLength) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}
//# sourceMappingURL=StartSentenceChallengeTool.js.map