import { findQuizAttemptById, findResourceShareLinkForResource, } from '../db/repository.js';
/**
 * The shared page a guest attempt came from, or null when the quiz no longer
 * has an active share link. A guest attempt does not record its link, but a
 * resource has at most one active run link, so the quiz leads back to it.
 */
function findGuestAttemptSharePath(quizId) {
    const shareLink = findResourceShareLinkForResource(quizId);
    return shareLink ? `/resources/shared/${encodeURIComponent(shareLink.id)}` : null;
}
/**
 * Where the close `X` of a guest attempt leads. The quiz's own page is the
 * owner's and sends a visitor without a session to `/login`, so a guest goes
 * back to the shared page, or to the landing when the link was revoked.
 */
export function buildGuestAttemptExitPath(quizId) {
    return findGuestAttemptSharePath(quizId) ?? '/';
}
/**
 * Recognizes the `returnTo` a guest carries to signup after submitting a
 * shared quiz (`/quiz-attempts/:id/evaluating?guestToken=…`), so the auth page
 * can say the answers are saved and what the account unlocks. Returns null
 * for any other `returnTo`, and for a token that does not match an unclaimed,
 * submitted attempt — the page then stays the generic one.
 */
export function findPendingGuestQuizEvaluation(returnTo) {
    let url;
    try {
        url = new URL(returnTo, 'http://return-to.local');
    }
    catch {
        return null;
    }
    const match = /^\/quiz-attempts\/([^/]+)\/evaluating$/.exec(url.pathname);
    const guestToken = url.searchParams.get('guestToken');
    if (!match || !guestToken) {
        return null;
    }
    let attemptId;
    try {
        attemptId = decodeURIComponent(match[1]);
    }
    catch {
        return null;
    }
    const attempt = findQuizAttemptById(attemptId);
    if (!attempt ||
        attempt.userId ||
        attempt.guestToken !== guestToken ||
        attempt.status !== 'submitted') {
        return null;
    }
    const quizTitle = typeof attempt.snapshot.title === 'string' ? attempt.snapshot.title.trim() : '';
    if (!quizTitle) {
        return null;
    }
    return { quizTitle, sharePath: findGuestAttemptSharePath(attempt.quizId) };
}
//# sourceMappingURL=guestAttempts.js.map