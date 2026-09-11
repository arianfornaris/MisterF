import { listResourcesSharedWithProfile, listSharedResourceParticipationForProfile, } from '../db/repository.js';
import { buildResourceDetailPath, buildResourceParticipationPath, } from '../resources/paths.js';
import { formatRelativeTime } from '../i18n/dates.js';
/**
 * How far back the teaching home looks when it leads with what happened while
 * the owner was away.
 *
 * Deliberately a fixed window rather than a per-profile "last seen" marker
 * (Roadmap V3 §1.14 open question, decided here): a stored marker advances on
 * render, so an accidental refresh would erase the badge the teacher came for,
 * and it would add a write to a read-only page. A week matches the cadence the
 * pilot cares about — what happened between one class and the next.
 */
const recentParticipationWindowDays = 7;
/**
 * Folders are absent by construction: both queries behind this module exclude
 * them, and `PedagogicalResourceType` makes that exclusion a type error to
 * forget rather than a missing entry discovered at render time.
 */
const resourceTypePresentation = {
    practice_guide: {
        familyClass: 'mf-fam-guia',
        iconClass: 'bi-journal-text',
        labelKey: 'chat.resourceTypePracticeGuide',
    },
    quiz: {
        familyClass: 'mf-fam-quiz',
        iconClass: 'bi-ui-checks-grid',
        labelKey: 'chat.resourceTypeQuiz',
    },
    roleplay: {
        familyClass: 'mf-fam-roleplay',
        iconClass: 'bi-person-video3',
        labelKey: 'chat.resourceTypeRoleplay',
    },
};
export function buildTeachingHomeData(input) {
    const recencyWindowStart = new Date(Date.now() - recentParticipationWindowDays * 24 * 60 * 60 * 1000).toISOString();
    const sharedActivities = listSharedResourceParticipationForProfile({
        profileId: input.profileId,
        recencyWindowStart,
        userId: input.userId,
    }).map((resource) => ({
        detailPath: buildResourceDetailPath(resource),
        familyClass: resourceTypePresentation[resource.type].familyClass,
        iconClass: resourceTypePresentation[resource.type].iconClass,
        id: resource.id,
        labelKey: resourceTypePresentation[resource.type].labelKey,
        lastParticipationRelative: resource.lastParticipationAt
            ? formatRelativeTime(resource.lastParticipationAt, input.locale)
            : null,
        participantCount: resource.participantCount,
        participationPath: buildResourceParticipationPath(resource),
        recentParticipantCount: resource.recentParticipantCount,
        title: resource.title,
    }));
    const recentActivities = sharedActivities.filter((activity) => activity.recentParticipantCount > 0);
    return {
        recentActivities,
        recentParticipantCount: recentActivities.reduce((total, activity) => total + activity.recentParticipantCount, 0),
        sharedActivities,
    };
}
/**
 * Both lists are capped rather than paginated: the home is a shortcut into the
 * catalog and the conversation history, not a second copy of either. The full
 * shared list is one link away (`/resources?type=with_me`), and every
 * conversation is already in the side panel.
 */
const learningHomeActivityLimit = 4;
const learningHomeConversationLimit = 3;
export function buildLearningHomeData(input) {
    const sharedWithMe = listResourcesSharedWithProfile({
        profileId: input.profileId,
        userId: input.userId,
    }).map((resource) => ({
        detailPath: buildResourceDetailPath(resource),
        familyClass: resourceTypePresentation[resource.type].familyClass,
        hasStarted: resource.hasStarted,
        iconClass: resourceTypePresentation[resource.type].iconClass,
        id: resource.id,
        labelKey: resourceTypePresentation[resource.type].labelKey,
        sharedRelative: formatRelativeTime(resource.sharedAt, input.locale),
        title: resource.title,
    }));
    const openConversations = input.conversations
        .filter((conversation) => !conversation.closedAt)
        .slice(0, learningHomeConversationLimit)
        .map((conversation) => ({
        path: `/c/${encodeURIComponent(conversation.id)}`,
        title: conversation.title,
        updatedRelative: conversation.relativeUpdatedAt,
    }));
    // The query orders not-yet-started activities first, so the first pending
    // one is also the most recently shared of them.
    const firstPendingActivity = sharedWithMe.find((activity) => !activity.hasStarted);
    const nextStep = firstPendingActivity
        ? { activity: firstPendingActivity, kind: 'activity' }
        : openConversations[0]
            ? { conversation: openConversations[0], kind: 'conversation' }
            : null;
    return {
        nextStep,
        openConversations: nextStep?.kind === 'conversation' ? openConversations.slice(1) : openConversations,
        pendingCount: sharedWithMe.filter((activity) => !activity.hasStarted).length,
        sharedWithMe: sharedWithMe.slice(0, learningHomeActivityLimit),
        sharedWithMeTotal: sharedWithMe.length,
    };
}
//# sourceMappingURL=data.js.map