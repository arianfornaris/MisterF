import {
  listResourcesSharedWithProfile,
  listSharedResourceParticipationForProfile,
  type PedagogicalResourceType,
} from '../db/repository.js';
import {
  buildResourceDetailPath,
  buildResourceParticipationPath,
} from '../resources/paths.js';
import { formatRelativeTime } from '../i18n/dates.js';
import type { Locale } from '../i18n/index.js';

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
const resourceTypePresentation: Record<
  PedagogicalResourceType,
  { familyClass: string; iconClass: string; labelKey: string }
> = {
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

export type TeachingHomeActivity = {
  detailPath: string;
  familyClass: string;
  iconClass: string;
  id: string;
  labelKey: string;
  lastParticipationRelative: string | null;
  participantCount: number;
  participationPath: string;
  recentParticipantCount: number;
  title: string;
};

export type TeachingHomeData = {
  /** Shared activities with participation inside the recency window. */
  recentActivities: TeachingHomeActivity[];
  /** Every shared activity, whether or not anyone has practiced it. */
  sharedActivities: TeachingHomeActivity[];
  /** Participations inside the recency window, across every shared activity. */
  recentParticipantCount: number;
};

export function buildTeachingHomeData(input: {
  locale: Locale;
  profileId: string;
  userId: string;
}): TeachingHomeData {
  const recencyWindowStart = new Date(
    Date.now() - recentParticipationWindowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

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

  const recentActivities = sharedActivities.filter(
    (activity) => activity.recentParticipantCount > 0,
  );

  return {
    recentActivities,
    recentParticipantCount: recentActivities.reduce(
      (total, activity) => total + activity.recentParticipantCount,
      0,
    ),
    sharedActivities,
  };
}

export type LearningHomeActivity = {
  detailPath: string;
  familyClass: string;
  hasStarted: boolean;
  iconClass: string;
  id: string;
  labelKey: string;
  sharedRelative: string;
  title: string;
};

export type LearningHomeConversation = {
  path: string;
  /** Empty for a conversation that has not been titled yet. */
  title: string;
  updatedRelative: string;
};

/**
 * The one action the page leads with. An activity someone is waiting on
 * outranks the learner's own open conversation: it is the only item on the
 * page that another person asked for.
 */
export type LearningHomeNextStep =
  | { kind: 'activity'; activity: LearningHomeActivity }
  | { kind: 'conversation'; conversation: LearningHomeConversation };

export type LearningHomeData = {
  /** Activities shared with this profile, not-yet-started ones first. Capped. */
  sharedWithMe: LearningHomeActivity[];
  /** Every activity shared with this profile, before the cap. */
  sharedWithMeTotal: number;
  /** How many of them the profile has not started yet. */
  pendingCount: number;
  /**
   * Open tutor conversations, most recent first, minus the one already leading
   * the page as the next step — the same row twice reads as two things to do.
   * Capped.
   */
  openConversations: LearningHomeConversation[];
  nextStep: LearningHomeNextStep | null;
};

/**
 * Both lists are capped rather than paginated: the home is a shortcut into the
 * catalog and the conversation history, not a second copy of either. The full
 * shared list is one link away (`/resources?type=with_me`), and every
 * conversation is already in the side panel.
 */
const learningHomeActivityLimit = 4;
const learningHomeConversationLimit = 3;

export function buildLearningHomeData(input: {
  conversations: ReadonlyArray<{
    closedAt: string | null;
    id: string;
    relativeUpdatedAt: string;
    title: string;
  }>;
  locale: Locale;
  profileId: string;
  userId: string;
}): LearningHomeData {
  const sharedWithMe = listResourcesSharedWithProfile({
    profileId: input.profileId,
    userId: input.userId,
  }).map((resource): LearningHomeActivity => ({
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
  const nextStep: LearningHomeNextStep | null = firstPendingActivity
    ? { activity: firstPendingActivity, kind: 'activity' }
    : openConversations[0]
      ? { conversation: openConversations[0], kind: 'conversation' }
      : null;

  return {
    nextStep,
    openConversations:
      nextStep?.kind === 'conversation' ? openConversations.slice(1) : openConversations,
    pendingCount: sharedWithMe.filter((activity) => !activity.hasStarted).length,
    sharedWithMe: sharedWithMe.slice(0, learningHomeActivityLimit),
    sharedWithMeTotal: sharedWithMe.length,
  };
}
