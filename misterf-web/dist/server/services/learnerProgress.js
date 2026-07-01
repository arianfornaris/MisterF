import { listLearnerProgressEvents, setQuizAttemptProgressEvent, setRoleplayAttemptProgressEvent, upsertLearnerProgressEvent, upsertLearnerProgressProfile, } from '../db/repository.js';
import { buildQuizEvaluationSummary, parseQuizDraft, } from './quizzes.js';
import { quizResultBlockSchema } from './llmTutor/schemas.js';
import { buildRoleplayProgressSummary, parseRoleplayDraft, roleplayEvaluationResultSchema, } from './roleplays.js';
const maxTimelineSummaryLength = 280;
export function recordQuizAttemptProgress(attempt) {
    if (!attempt.userId ||
        !attempt.profileId ||
        !attempt.result) {
        return;
    }
    const result = quizResultBlockSchema.safeParse(attempt.result);
    if (!result.success) {
        return;
    }
    const draft = parseQuizDraft(attempt.snapshot);
    const summary = buildQuizEvaluationSummary(result.data);
    const title = compactText(`Quiz: ${draft.title}`, 120);
    const event = upsertLearnerProgressEvent({
        details: buildQuizAttemptEventDetails({
            attempt,
            draft,
            result: result.data,
        }),
        eventDate: attempt.evaluatedAt ?? attempt.submittedAt ?? attempt.updatedAt,
        profileId: attempt.profileId,
        sourceId: attempt.id,
        sourceType: 'quiz_attempt',
        summary: compactText(`Completaste ${summary.totalCount} ejercicios: ${summary.correctCount} correctos, ${summary.partialCount} parciales y ${summary.incorrectCount} por mejorar.`, maxTimelineSummaryLength),
        title,
        userId: attempt.userId,
    });
    setQuizAttemptProgressEvent({
        attemptId: attempt.id,
        progressEventId: event.id,
    });
    refreshLearnerProgressSummary({
        profileId: attempt.profileId,
        userId: attempt.userId,
    });
}
export function recordRoleplayAttemptProgress(attempt) {
    if (!attempt.userId ||
        !attempt.profileId ||
        !attempt.result) {
        return;
    }
    const result = roleplayEvaluationResultSchema.safeParse(attempt.result);
    if (!result.success) {
        return;
    }
    const draft = parseRoleplayDraft(attempt.snapshot);
    const event = upsertLearnerProgressEvent({
        details: buildRoleplayAttemptEventDetails({
            attempt,
            draft,
            result: result.data,
        }),
        eventDate: attempt.evaluatedAt ?? attempt.submittedAt ?? attempt.updatedAt,
        profileId: attempt.profileId,
        sourceId: attempt.id,
        sourceType: 'roleplay_attempt',
        summary: buildRoleplayProgressSummary(result.data),
        title: compactText(`Roleplay: ${draft.title}`, 120),
        userId: attempt.userId,
    });
    setRoleplayAttemptProgressEvent({
        attemptId: attempt.id,
        progressEventId: event.id,
    });
    refreshLearnerProgressSummary({
        profileId: attempt.profileId,
        userId: attempt.userId,
    });
}
export function recordTutorConversationReportProgress(report) {
    upsertLearnerProgressEvent({
        details: buildTutorReportEventDetails(report),
        eventDate: report.createdAt,
        profileId: report.profileId,
        sourceId: report.id,
        sourceType: 'tutor_conversation_report',
        summary: compactText(report.summaryDescription, maxTimelineSummaryLength),
        title: compactText(report.summaryTitle, 120),
        userId: report.userId,
    });
    refreshLearnerProgressSummary({
        profileId: report.profileId,
        userId: report.userId,
    });
}
export function refreshLearnerProgressSummary(input) {
    const events = listLearnerProgressEvents({
        limit: 30,
        profileId: input.profileId,
        userId: input.userId,
    });
    const latest = events[0] ?? null;
    const strengths = uniqueLimited(events.flatMap((event) => event.details.progress), 8);
    const focusAreas = uniqueLimited(events.flatMap((event) => [
        ...event.details.difficulties,
        ...event.details.recommendations,
    ]), 10);
    const vocabulary = uniqueLimited(events.flatMap((event) => event.details.vocabulary), 24);
    const recommendedPractice = uniqueLimited(events.flatMap((event) => [
        ...event.details.practiced.map((item) => `Seguir practicando: ${item}`),
        ...event.details.recommendations,
    ]), 10);
    const summary = {
        focusAreas,
        overview: buildOverview({
            eventCount: events.length,
            latestSummary: latest?.summary ?? '',
            latestTitle: latest?.title ?? '',
        }),
        recommendedPractice,
        strengths,
        updatedFromEvents: events.length,
        vocabulary,
    };
    upsertLearnerProgressProfile({
        profileId: input.profileId,
        summary,
        userId: input.userId,
    });
    return summary;
}
function buildTutorReportEventDetails(report) {
    return {
        difficulties: report.report.difficultyAreas
            .map((area) => area.title || area.description)
            .filter(Boolean)
            .map((item) => compactText(item, 120))
            .slice(0, 4),
        practiced: report.report.practicedTopics
            .map((item) => compactText(item, 120))
            .slice(0, 5),
        progress: report.report.progressHighlights
            .map((item) => compactText(item, 140))
            .slice(0, 4),
        recommendations: [...report.report.recommendations, ...report.report.nextSteps]
            .map((item) => compactText(item, 140))
            .slice(0, 5),
        vocabulary: report.report.vocabulary
            .map((item) => item.term)
            .filter(Boolean)
            .map((item) => compactText(item, 80))
            .slice(0, 12),
    };
}
function buildQuizAttemptEventDetails(input) {
    const missedItems = input.result.items.filter((item) => item.evaluation.status !== 'correct');
    // Keep progress entries concise. A quiz has no LLM-generated strength/summary
    // phrases like a roleplay, only per-item evaluations, so we surface the short
    // feedback for missed items as focus areas and never dump the raw item prompts
    // (which are long, bilingual question texts) into the timeline or the summary.
    return {
        difficulties: uniqueLimited(missedItems.map((item) => compactText(item.evaluation.feedback, 140)), 4),
        practiced: uniqueLimited([input.draft.targetTopic, input.draft.level].filter(Boolean), 5),
        progress: [],
        recommendations: [],
        resourceId: input.attempt.quizId,
        resourceType: 'quiz',
        vocabulary: uniqueLimited(extractQuizInlineReviewText(input.result), 12)
            .map((item) => compactText(item, 80)),
    };
}
function buildRoleplayAttemptEventDetails(input) {
    return {
        difficulties: input.result.difficulties
            .map((item) => compactText(item, 140))
            .slice(0, 6),
        practiced: uniqueLimited([
            input.draft.title,
            compactText(input.draft.pedagogicalFocus, 120),
            input.draft.level,
        ].filter(Boolean), 8),
        progress: input.result.strengths
            .map((item) => compactText(item, 140))
            .slice(0, 5),
        recommendations: input.result.recommendations
            .map((item) => compactText(item, 140))
            .slice(0, 6),
        resourceId: input.attempt.roleplayId,
        resourceType: 'roleplay',
        vocabulary: input.result.vocabulary
            .map((item) => compactText(item, 80))
            .slice(0, 12),
    };
}
function extractQuizInlineReviewText(result) {
    return result.items.flatMap((item) => {
        const inlineReview = item.inlineReview;
        if (!inlineReview) {
            return [];
        }
        if ('parts' in inlineReview) {
            return inlineReview.parts
                .filter((part) => part.status !== 'correct')
                .map((part) => part.text);
        }
        if ('options' in inlineReview) {
            return inlineReview.options
                .filter((option) => option.status === 'missed' || option.status === 'error')
                .map((option) => option.text);
        }
        if ('pairs' in inlineReview) {
            return inlineReview.pairs
                .filter((pair) => pair.status === 'error')
                .map((pair) => `${pair.left} -> ${pair.right}`);
        }
        return [];
    });
}
function buildOverview(input) {
    if (input.eventCount === 0) {
        return 'Todavía no hay suficiente actividad cerrada para construir un progreso global.';
    }
    const prefix = input.eventCount === 1
        ? 'Progreso basado en 1 práctica cerrada.'
        : `Progreso basado en ${input.eventCount} prácticas recientes.`;
    const latest = input.latestSummary || input.latestTitle;
    return latest
        ? `${prefix} Última señal importante: ${compactText(latest, 220)}`
        : prefix;
}
function uniqueLimited(items, limit) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const normalized = item.replace(/\s+/g, ' ').trim();
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(normalized);
        if (result.length >= limit) {
            break;
        }
    }
    return result;
}
function compactText(value, maxLength) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
//# sourceMappingURL=learnerProgress.js.map