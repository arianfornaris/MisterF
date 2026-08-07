import {
  findConversationForUser,
  findQuizAttemptById,
  findResourceAccessForProfile,
  findRoleplayAttemptById,
  getConversationPracticeGuideSnapshot,
  getConversationQuizAttemptSnapshot,
  getConversationRoleplayAttemptSnapshot,
  getConversationTutorReportSnapshot,
  type StoredConversation,
} from '../db/repository.js';

/**
 * What a conversation was derived from.
 *
 * `summary` is a follow-up practice started from a finalized conversation
 * report; it is the only kind that can carry a `via`, because the summary it
 * comes from may itself belong to a resource.
 */
export type ConversationOriginKind = 'practice_guide' | 'quiz' | 'roleplay' | 'summary';

export type ConversationOriginResource = {
  kind: ConversationOriginKind;
  /**
   * Null when the viewer can no longer open the resource — it was archived,
   * deleted, or the share was revoked. The title still shows, from the
   * conversation's own frozen snapshot.
   */
  path: string | null;
  title: string;
};

export type ConversationOrigin = ConversationOriginResource & {
  /** The result or summary this conversation practices from, when there is one. */
  resultPath: string | null;
  /** For a `summary` origin, the resource that summary was produced in. */
  via: ConversationOriginResource | null;
};

/**
 * Follow-up chats chain: a quiz result is practiced, that practice is
 * finalized, and its summary is practiced again. Two hops is already more
 * provenance than a learner reads, so resolution stops there.
 */
const maxOriginDepth = 2;

/**
 * Resolves what a conversation derives from, for display at the top of the
 * chat. Reads the conversation's frozen snapshots rather than the live
 * resource, so editing or archiving the source never rewrites the chat's own
 * history — only whether it still links anywhere.
 */
export function resolveConversationOrigin(
  conversation: StoredConversation,
  depth = 0,
): ConversationOrigin | null {
  const practiceGuide = getConversationPracticeGuideSnapshot(conversation.id);
  if (practiceGuide) {
    return {
      kind: 'practice_guide',
      path: resolveResourcePath(conversation, practiceGuide.practiceGuideId, '/practice-guides'),
      resultPath: null,
      title: practiceGuide.title,
      via: null,
    };
  }

  const quizAttempt = getConversationQuizAttemptSnapshot(conversation.id);
  if (quizAttempt) {
    // The snapshot froze the quiz's content, not its id; the attempt row is
    // where the resource it belongs to is recorded.
    const quizId = findQuizAttemptById(quizAttempt.quizAttemptId)?.quizId ?? null;
    return {
      kind: 'quiz',
      path: resolveResourcePath(conversation, quizId, '/quizzes'),
      resultPath: `/quiz-attempts/${encodeURIComponent(quizAttempt.quizAttemptId)}/result`,
      title: quizAttempt.quizTitle,
      via: null,
    };
  }

  const roleplayAttempt = getConversationRoleplayAttemptSnapshot(conversation.id);
  if (roleplayAttempt) {
    const roleplayId =
      findRoleplayAttemptById(roleplayAttempt.roleplayAttemptId)?.roleplayId ?? null;
    return {
      kind: 'roleplay',
      path: resolveResourcePath(conversation, roleplayId, '/roleplays'),
      resultPath: `/roleplay-attempts/${encodeURIComponent(roleplayAttempt.roleplayAttemptId)}/result`,
      title: roleplayAttempt.roleplayTitle,
      via: null,
    };
  }

  const tutorReport = getConversationTutorReportSnapshot(conversation.id);
  if (tutorReport) {
    const sourceConversation = findConversationForUser(
      tutorReport.sourceConversationId,
      conversation.userId,
    );

    return {
      kind: 'summary',
      path: sourceConversation
        ? `/c/${encodeURIComponent(sourceConversation.id)}?tab=summary`
        : null,
      resultPath: null,
      title: tutorReport.reportSummaryTitle,
      via:
        sourceConversation && depth < maxOriginDepth
          ? toOriginResource(resolveConversationOrigin(sourceConversation, depth + 1))
          : null,
    };
  }

  return null;
}

function toOriginResource(origin: ConversationOrigin | null): ConversationOriginResource | null {
  if (!origin) {
    return null;
  }

  return { kind: origin.kind, path: origin.path, title: origin.title };
}

/**
 * A path only when this profile can still open the resource. `resources` is the
 * generic row every type shares an id with, so one access check covers quizzes,
 * roleplays, and practice guides — owned or reached through a grant.
 */
function resolveResourcePath(
  conversation: StoredConversation,
  resourceId: string | null,
  basePath: string,
): string | null {
  if (!resourceId) {
    return null;
  }

  const access = findResourceAccessForProfile({
    profileId: conversation.profileId,
    resourceId,
    userId: conversation.userId,
  });

  return access ? `${basePath}/${encodeURIComponent(resourceId)}` : null;
}
