import { createQuiz, createPracticeGuide, createRoleplay, } from '../db/repository.js';
import { generateQuizDraft, generatePracticeGuideDraft, generateRoleplayDraft, } from './resourceDrafts.js';
const contextResourceTypeMeta = {
    quiz: {
        articledLabel: 'un quiz',
        detailPath: (id) => `/quizzes/${encodeURIComponent(id)}`,
        label: 'quiz',
        promptIntro: 'Crea un quiz evaluable usando el contexto proporcionado.',
    },
    practice_guide: {
        articledLabel: 'una guía de práctica',
        detailPath: (id) => `/practice-guides/${encodeURIComponent(id)}`,
        label: 'guía de práctica',
        promptIntro: 'Crea una guía de práctica reutilizable usando el contexto proporcionado.',
    },
    roleplay: {
        articledLabel: 'un roleplay',
        detailPath: (id) => `/roleplays/${encodeURIComponent(id)}`,
        label: 'roleplay',
        promptIntro: 'Crea un roleplay usando el contexto proporcionado.',
    },
};
export function normalizeContextResourceType(value) {
    return value === 'quiz' || value === 'practice_guide' || value === 'roleplay'
        ? value
        : null;
}
export function contextResourceTypeLabel(type) {
    return contextResourceTypeMeta[type].label;
}
export function articledContextResourceTypeLabel(type) {
    return contextResourceTypeMeta[type].articledLabel;
}
/**
 * Builds the seed prompt for AI authoring from a free-form context. The learner
 * instruction is primary; the context (a conversation, a summary, or an attempt
 * result) is supporting material.
 */
export function buildResourceFromContextPrompt(input) {
    const lines = [
        contextResourceTypeMeta[input.type].promptIntro,
        'La indicación del usuario es lo principal. Usa el contexto como apoyo para inferir el tema, los objetivos y el tipo de práctica que más le conviene al estudiante.',
    ];
    if (input.instruction) {
        lines.push(`Indicación del usuario: ${input.instruction}`);
    }
    lines.push('', `${input.contextLabel}:`, input.context || '(sin contexto)');
    return lines.join('\n');
}
/**
 * Generates the matching AI draft for the resource type and persists it. Returns
 * the new resource detail path and title so callers can link or redirect to it.
 */
export async function createResourceFromContextDraft(input) {
    const { openRouterApiKey, profileId, prompt, type, userId } = input;
    const meta = contextResourceTypeMeta[type];
    if (type === 'practice_guide') {
        const draft = await generatePracticeGuideDraft({ openRouterApiKey, prompt });
        const practiceGuide = createPracticeGuide({
            description: draft.description,
            profileId,
            title: draft.title,
            tutorInstructions: draft.tutorInstructions,
            userId,
        });
        return { detailPath: meta.detailPath(practiceGuide.id), title: practiceGuide.title };
    }
    if (type === 'quiz') {
        const draft = await generateQuizDraft({ openRouterApiKey, prompt });
        const quiz = createQuiz({
            description: draft.description,
            instructions: draft.instructions,
            level: draft.level,
            profileId,
            quiz: draft,
            targetTopic: draft.targetTopic,
            title: draft.title,
            userId,
        });
        return { detailPath: meta.detailPath(quiz.id), title: quiz.title };
    }
    const draft = await generateRoleplayDraft({ openRouterApiKey, prompt });
    const roleplay = createRoleplay({ ...draft, profileId, userId });
    return { detailPath: meta.detailPath(roleplay.id), title: roleplay.title };
}
//# sourceMappingURL=resourceFromContext.js.map