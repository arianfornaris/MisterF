import { listResourcesSharedWithProfile, listSharedResourceParticipationForProfile, } from '../db/repository.js';
import { buildResourceDetailPath, buildResourceParticipationPath, } from '../resources/paths.js';
import { formatRelativeTime } from '../pages/shell.js';
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
        iconClass: 'bi-journal-text',
        labelKey: 'chat.resourceTypePracticeGuide',
    },
    quiz: { iconClass: 'bi-ui-checks-grid', labelKey: 'chat.resourceTypeQuiz' },
    roleplay: { iconClass: 'bi-person-video3', labelKey: 'chat.resourceTypeRoleplay' },
};
export function buildTeachingHomeData(input) {
    const recencyWindowStart = new Date(Date.now() - recentParticipationWindowDays * 24 * 60 * 60 * 1000).toISOString();
    const sharedActivities = listSharedResourceParticipationForProfile({
        profileId: input.profileId,
        recencyWindowStart,
        userId: input.userId,
    }).map((resource) => ({
        detailPath: buildResourceDetailPath(resource),
        iconClass: resourceTypePresentation[resource.type].iconClass,
        id: resource.id,
        labelKey: resourceTypePresentation[resource.type].labelKey,
        lastParticipationRelative: resource.lastParticipationAt
            ? formatRelativeTime(resource.lastParticipationAt)
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
 * The learning composition's panel. Capped rather than paginated: the panel
 * sits above the composer and is a shortcut into the catalog, not a second
 * catalog.
 */
const learningHomeActivityLimit = 4;
export function buildLearningHomeData(input) {
    const sharedWithMe = listResourcesSharedWithProfile({
        profileId: input.profileId,
        userId: input.userId,
    });
    return {
        pendingCount: sharedWithMe.filter((resource) => !resource.hasStarted).length,
        sharedWithMe: sharedWithMe
            .slice(0, learningHomeActivityLimit)
            .map((resource) => ({
            detailPath: buildResourceDetailPath(resource),
            hasStarted: resource.hasStarted,
            iconClass: resourceTypePresentation[resource.type].iconClass,
            id: resource.id,
            labelKey: resourceTypePresentation[resource.type].labelKey,
            sharedRelative: formatRelativeTime(resource.sharedAt),
            title: resource.title,
        })),
    };
}
//# sourceMappingURL=data.js.map