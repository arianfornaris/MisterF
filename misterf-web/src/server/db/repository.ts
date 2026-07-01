import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from './database.js';

export type MessageRole = 'user' | 'model';

export type StoredProfile = {
  id: string;
  userId: string;
  modelTier: 'advanced' | 'max' | 'regular';
  name: string;
  description: string;
  learningContext: string;
  profileOnboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredConversation = {
  activeAgent: 'tutor';
  chatRoomConversationReportId: string | null;
  closedAt: string | null;
  practiceGuideId: string | null;
  id: string;
  modelTier: 'advanced' | 'max' | 'regular';
  profileId: string;
  titleUpdatedByUser: boolean;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type ResourceType = 'quiz' | 'practice_guide' | 'resource_folder' | 'roleplay';
export type ResourceShareKind = 'link' | 'profile';

export type StoredResource = {
  archivedAt: string | null;
  createdAt: string;
  description: string;
  id: string;
  level: string;
  profileId: string;
  sharedVia: ResourceShareKind | null;
  sourceProfileId: string | null;
  sourceResourceId: string | null;
  sourceUserId: string | null;
  title: string;
  topic: string;
  type: ResourceType;
  updatedAt: string;
  userId: string;
};

export type ResourceAccessKind = 'owner' | 'shared';

export type StoredAccessibleResource = StoredResource & {
  accessCreatedAt: string | null;
  accessKind: ResourceAccessKind;
  grantId: string | null;
  grantedVia: ResourceShareKind | null;
  shareLinkId: string | null;
};

export type StoredResourceAccessGrant = {
  createdAt: string;
  grantedByUserId: string;
  grantedVia: ResourceShareKind;
  id: string;
  profileId: string;
  resourceId: string;
  revokedAt: string | null;
  shareLinkId: string | null;
  updatedAt: string;
  userId: string;
};

export type StoredResourceFolderItem = {
  createdAt: string;
  folderId: string;
  position: number;
  resource: StoredResource;
  resourceId: string;
  resourceType: ResourceType;
  updatedAt: string;
};

export type StoredResourceFolderMoveOption = StoredResource & {
  parentFolderId: string | null;
};

export type StoredResourceShareLink = {
  createdAt: string;
  id: string;
  resourceId: string;
  revokedAt: string | null;
};

export type StoredChatRoom = {
  archivedAt: string | null;
  id: string;
  userId: string;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourceRoomId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatRoomCharacter = {
  id: string;
  roomId: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatRoomConversation = {
  id: string;
  roomId: string;
  userId: string;
  profileId: string;
  reportCreatedAt: string | null;
  reportId: string | null;
  reportPracticeGuideId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatRoomConversationReportSentenceEvaluation = {
  type: 'sentence_evaluation';
  parts: Array<{
    explanation?: string;
    status: 'correct' | 'improve' | 'error';
    text: string;
  }>;
};

export type StoredChatRoomConversationReportSlide = {
  title: string;
  evaluationDescription: string;
  messageEvaluation: StoredChatRoomConversationReportSentenceEvaluation;
};

export type StoredChatRoomConversationReport = {
  id: string;
  conversationId: string;
  roomId: string;
  userId: string;
  profileId: string;
  summaryTitle: string;
  summaryDescription: string;
  slides: StoredChatRoomConversationReportSlide[];
  practiceGuideId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatRoomShareLink = {
  roomId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type ChatRoomMessageSenderType = 'character' | 'system' | 'user';
export type ChatRoomMessageEvaluationStatus = 'ok' | 'warning';

export type StoredChatRoomMessage = {
  id: number;
  conversationId: string;
  senderType: ChatRoomMessageSenderType;
  senderName: string;
  content: string;
  evaluationStatus: ChatRoomMessageEvaluationStatus | null;
  evaluationProblem: string | null;
  evaluationCreatedAt: string | null;
  createdAt: string;
};

export type StoredPracticeGuide = {
  archivedAt: string | null;
  id: string;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourcePracticeGuideId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPracticeGuideShareLink = {
  practiceGuideId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredConversationPracticeGuideSnapshot = {
  practiceGuideId: string | null;
  conversationId: string;
  createdAt: string;
  description: string;
  title: string;
  tutorInstructions: string;
};

export type StoredConversationChatRoomReportSnapshot = {
  chatRoomConversationId: string;
  chatRoomConversationReportId: string;
  conversationId: string;
  createdAt: string;
  reportSummaryDescription: string;
  reportSummaryTitle: string;
  roomDescription: string;
  roomTitle: string;
  slidesJson: string;
};

export type StoredTutorConversationReportData = {
  difficultyAreas: Array<{
    description: string;
    title: string;
  }>;
  nextSteps: string[];
  practicedTopics: string[];
  progressHighlights: string[];
  recommendations: string[];
  usefulPhrases: string[];
  vocabulary: Array<{
    example?: string;
    meaning: string;
    term: string;
  }>;
};

export type StoredTutorConversationReport = {
  id: string;
  conversationId: string;
  userId: string;
  profileId: string;
  summaryTitle: string;
  summaryDescription: string;
  report: StoredTutorConversationReportData;
  practiceGuideId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredConversationTutorReportSnapshot = {
  conversationId: string;
  createdAt: string;
  reportJson: string;
  reportSummaryDescription: string;
  reportSummaryTitle: string;
  sourceConversationId: string;
  tutorConversationReportId: string;
};

export type StoredQuiz = {
  allowPublicAttempts: boolean;
  archivedAt: string | null;
  authoringMessages: QuizAuthoringMessage[];
  createdAt: string;
  description: string;
  id: string;
  instructions: string;
  level: string;
  profileId: string;
  quiz: Record<string, unknown>;
  sharedVia: 'link' | 'profile' | null;
  sourceQuizId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  targetTopic: string;
  title: string;
  updatedAt: string;
  userId: string;
};

export type QuizAuthoringMessage = {
  content: string;
  createdAt: string;
  draftSnapshot?: Record<string, unknown>;
  role: 'assistant' | 'user';
};

export type StoredQuizShareLink = {
  quizId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredQuizAttempt = {
  quizId: string;
  claimToken: string | null;
  createdAt: string;
  evaluatedAt: string | null;
  guestToken: string | null;
  id: string;
  profileId: string | null;
  progressEventId: number | null;
  responses: unknown[];
  result: Record<string, unknown> | null;
  snapshot: Record<string, unknown>;
  startedAt: string;
  status: 'draft' | 'evaluated' | 'evaluating' | 'failed' | 'submitted';
  submittedAt: string | null;
  updatedAt: string;
  userId: string | null;
};

export type StoredConversationQuizAttemptSnapshot = {
  quizAttemptId: string;
  quizDescription: string;
  quizSnapshot: Record<string, unknown>;
  quizTargetTopic: string;
  quizTitle: string;
  conversationId: string;
  createdAt: string;
  responses: unknown[];
  result: Record<string, unknown>;
};

export type RoleplayAuthoringMessage = {
  content: string;
  createdAt: string;
  draftSnapshot?: Record<string, unknown>;
  role: 'assistant' | 'user';
};

export type RoleplayCharacter = {
  description: string;
  id: string;
  name: string;
};

export type RoleplayTurn = {
  characterId: string;
  createdAt: string;
  speaker: 'ai' | 'learner';
  text: string;
};

export type StoredRoleplay = {
  archivedAt: string | null;
  authoringMessages: RoleplayAuthoringMessage[];
  characters: RoleplayCharacter[];
  createdAt: string;
  description: string;
  id: string;
  level: string;
  maxLearnerTurns: number | null;
  pedagogicalFocus: string;
  profileId: string;
  scenario: string;
  sharedVia: 'link' | 'profile' | null;
  sourceProfileId: string | null;
  sourceRoleplayId: string | null;
  sourceUserId: string | null;
  title: string;
  updatedAt: string;
  userId: string;
};

export type StoredRoleplayAttempt = {
  createdAt: string;
  evaluatedAt: string | null;
  id: string;
  profileId: string | null;
  progressEventId: number | null;
  result: Record<string, unknown> | null;
  roleplayId: string;
  snapshot: Record<string, unknown>;
  startedAt: string;
  status: 'draft' | 'evaluated' | 'evaluating' | 'failed' | 'in_progress';
  submittedAt: string | null;
  turns: RoleplayTurn[];
  updatedAt: string;
  userId: string | null;
};

export type StoredConversationRoleplayAttemptSnapshot = {
  conversationId: string;
  createdAt: string;
  result: Record<string, unknown>;
  roleplayAttemptId: string;
  roleplayDescription: string;
  roleplaySnapshot: Record<string, unknown>;
  roleplayTitle: string;
  turns: RoleplayTurn[];
};

export type StoredLearnerProgressSummary = {
  focusAreas: string[];
  overview: string;
  recommendedPractice: string[];
  strengths: string[];
  updatedFromEvents: number;
  vocabulary: string[];
};

export type StoredLearnerProgressProfile = {
  id: string;
  profileId: string;
  summary: StoredLearnerProgressSummary;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredLearnerProgressEventDetails = {
  difficulties: string[];
  practiced: string[];
  progress: string[];
  recommendations: string[];
  resourceId?: string;
  resourceType?: ResourceType;
  vocabulary: string[];
};

export type LearnerProgressSourceType =
  | 'quiz_attempt'
  | 'chat_room_conversation_report'
  | 'roleplay_attempt'
  | 'tutor_conversation_report';

export type StoredLearnerProgressEvent = {
  id: number;
  details: StoredLearnerProgressEventDetails;
  eventDate: string;
  profileId: string;
  sourceId: string;
  sourceType: LearnerProgressSourceType;
  summary: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredMessage = {
  id: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type StoredTutorPlanStepStatus =
  | 'active'
  | 'done'
  | 'pending'
  | 'skipped';

export type StoredTutorPlanStep = {
  id: string;
  label: string;
  status: StoredTutorPlanStepStatus;
};

export type StoredTutorPlan = {
  conversationId: string;
  createdAt: string;
  steps: StoredTutorPlanStep[];
  summary?: string;
  title: string;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  user_id: string;
  model_tier: 'advanced' | 'max' | 'regular';
  name: string;
  description: string;
  learning_context: string;
  profile_onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ChatRoomRow = {
  archived_at: string | null;
  id: string;
  user_id: string;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_room_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type ChatRoomShareLinkRow = {
  room_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type ChatRoomCharacterRow = {
  id: string;
  room_id: string;
  name: string;
  short_description: string;
  full_description: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type ChatRoomConversationRow = {
  id: string;
  room_id: string;
  user_id: string;
  profile_id: string;
  report_created_at: string | null;
  report_id: string | null;
  report_practice_guide_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatRoomConversationReportRow = {
  id: string;
  conversation_id: string;
  room_id: string;
  user_id: string;
  profile_id: string;
  summary_title: string;
  summary_description: string;
  slides_json: string;
  practice_guide_id: string | null;
  created_at: string;
  updated_at: string;
};

type ChatRoomMessageRow = {
  id: number;
  conversation_id: string;
  sender_type: ChatRoomMessageSenderType;
  sender_name: string;
  content: string;
  evaluation_status: ChatRoomMessageEvaluationStatus | null;
  evaluation_problem: string | null;
  evaluation_created_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: number;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata: string | null;
  created_at: string;
};

type ConversationTutorPlanRow = {
  conversation_id: string;
  plan_json: string;
  created_at: string;
  updated_at: string;
};

type ConversationRow = {
  active_agent: string;
  chat_room_conversation_report_id: string | null;
  closed_at: string | null;
  practice_guide_id: string | null;
  id: string;
  model_tier: 'advanced' | 'max' | 'regular';
  profile_id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type ResourceRow = {
  archived_at: string | null;
  created_at: string;
  description: string;
  id: string;
  level: string;
  profile_id: string;
  shared_via: ResourceShareKind | null;
  source_profile_id: string | null;
  source_resource_id: string | null;
  source_user_id: string | null;
  title: string;
  topic: string;
  type: ResourceType;
  updated_at: string;
  user_id: string;
};

type AccessibleResourceRow = ResourceRow & {
  access_created_at: string | null;
  access_kind: ResourceAccessKind;
  grant_id: string | null;
  granted_via: ResourceShareKind | null;
  share_link_id: string | null;
};

type ResourceFolderItemRow = ResourceRow & {
  folder_id: string;
  position: number;
  resource_id: string;
  resource_type: ResourceType;
  item_created_at: string;
  item_updated_at: string;
};

type ResourceFolderMoveOptionRow = ResourceRow & {
  parent_folder_id: string | null;
};

type ResourceShareLinkRow = {
  created_at: string;
  id: string;
  resource_id: string;
  revoked_at: string | null;
};

type ResourceAccessGrantRow = {
  created_at: string;
  granted_by_user_id: string;
  granted_via: ResourceShareKind;
  id: string;
  profile_id: string;
  resource_id: string;
  revoked_at: string | null;
  share_link_id: string | null;
  updated_at: string;
  user_id: string;
};

type TutorConversationReportRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  profile_id: string;
  summary_title: string;
  summary_description: string;
  report_json: string;
  practice_guide_id: string | null;
  created_at: string;
  updated_at: string;
};

type PracticeGuideRow = {
  archived_at: string | null;
  id: string;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_practice_guide_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  user_id: string;
  title: string;
  description: string;
  tutor_instructions: string;
  created_at: string;
  updated_at: string;
};

type PracticeGuideShareLinkRow = {
  practice_guide_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type ConversationPracticeGuideSnapshotRow = {
  practice_guide_id: string | null;
  conversation_id: string;
  created_at: string;
  description: string;
  title: string;
  tutor_instructions: string;
};

type ConversationChatRoomReportSnapshotRow = {
  chat_room_conversation_id: string;
  chat_room_conversation_report_id: string;
  conversation_id: string;
  created_at: string;
  report_summary_description: string;
  report_summary_title: string;
  room_description: string;
  room_title: string;
  slides_json: string;
};

type ConversationTutorReportSnapshotRow = {
  conversation_id: string;
  created_at: string;
  report_json: string;
  report_summary_description: string;
  report_summary_title: string;
  source_conversation_id: string;
  tutor_conversation_report_id: string;
};

type QuizRow = {
  allow_public_attempts: number;
  archived_at: string | null;
  authoring_messages_json: string;
  created_at: string;
  description: string;
  id: string;
  instructions: string;
  level: string;
  profile_id: string;
  quiz_json: string;
  shared_via: 'link' | 'profile' | null;
  source_quiz_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  target_topic: string;
  title: string;
  updated_at: string;
  user_id: string;
};

type QuizShareLinkRow = {
  quiz_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type QuizAttemptRow = {
  quiz_id: string;
  claim_token: string | null;
  created_at: string;
  evaluated_at: string | null;
  guest_token: string | null;
  id: string;
  profile_id: string | null;
  progress_event_id: number | null;
  responses_json: string;
  result_json: string | null;
  snapshot_json: string;
  started_at: string;
  status: 'draft' | 'evaluated' | 'evaluating' | 'failed' | 'submitted';
  submitted_at: string | null;
  updated_at: string;
  user_id: string | null;
};

type ConversationQuizAttemptSnapshotRow = {
  quiz_attempt_id: string;
  quiz_description: string;
  quiz_snapshot_json: string;
  quiz_target_topic: string;
  quiz_title: string;
  conversation_id: string;
  created_at: string;
  responses_json: string;
  result_json: string;
};

type RoleplayRow = {
  archived_at: string | null;
  authoring_messages_json: string;
  characters_json: string;
  created_at: string;
  description: string;
  id: string;
  level: string;
  max_learner_turns: number | null;
  pedagogical_focus: string;
  profile_id: string;
  scenario: string;
  shared_via: 'link' | 'profile' | null;
  source_profile_id: string | null;
  source_roleplay_id: string | null;
  source_user_id: string | null;
  title: string;
  updated_at: string;
  user_id: string;
};

type RoleplayAttemptRow = {
  created_at: string;
  evaluated_at: string | null;
  id: string;
  profile_id: string | null;
  progress_event_id: number | null;
  result_json: string | null;
  roleplay_id: string;
  snapshot_json: string;
  started_at: string;
  status: 'draft' | 'evaluated' | 'evaluating' | 'failed' | 'in_progress';
  submitted_at: string | null;
  turns_json: string;
  updated_at: string;
  user_id: string | null;
};

type ConversationRoleplayAttemptSnapshotRow = {
  conversation_id: string;
  created_at: string;
  result_json: string;
  roleplay_attempt_id: string;
  roleplay_description: string;
  roleplay_snapshot_json: string;
  roleplay_title: string;
  turns_json: string;
};

type LearnerProgressProfileRow = {
  id: string;
  user_id: string;
  profile_id: string;
  summary_json: string;
  created_at: string;
  updated_at: string;
};

type LearnerProgressEventRow = {
  id: number;
  user_id: string;
  profile_id: string;
  source_type: LearnerProgressSourceType;
  source_id: string;
  event_date: string;
  title: string;
  summary: string;
  details_json: string;
  created_at: string;
  updated_at: string;
};

const defaultConversationTitle = 'Nueva conversación';
const defaultProfileName = 'Perfil principal';

function toStoredProfile(row: ProfileRow): StoredProfile {
  return {
    id: row.id,
    userId: row.user_id,
    modelTier: row.model_tier,
    name: row.name,
    description: row.description,
    learningContext: row.learning_context,
    profileOnboardingCompletedAt: row.profile_onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredConversation(row: ConversationRow): StoredConversation {
  return {
    activeAgent: 'tutor',
    chatRoomConversationReportId: row.chat_room_conversation_report_id,
    closedAt: row.closed_at,
    practiceGuideId: row.practice_guide_id,
    id: row.id,
    modelTier: row.model_tier,
    profileId: row.profile_id,
    title: row.title,
    titleUpdatedByUser: Boolean(row.title_updated_by_user),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredResource(row: ResourceRow): StoredResource {
  return {
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    level: row.level,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourceProfileId: row.source_profile_id,
    sourceResourceId: row.source_resource_id,
    sourceUserId: row.source_user_id,
    title: row.title,
    topic: row.topic,
    type: row.type,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toStoredAccessibleResource(row: AccessibleResourceRow): StoredAccessibleResource {
  return {
    ...toStoredResource(row),
    accessCreatedAt: row.access_created_at,
    accessKind: row.access_kind,
    grantId: row.grant_id,
    grantedVia: row.granted_via,
    shareLinkId: row.share_link_id,
  };
}

function toStoredResourceAccessGrant(
  row: ResourceAccessGrantRow,
): StoredResourceAccessGrant {
  return {
    createdAt: row.created_at,
    grantedByUserId: row.granted_by_user_id,
    grantedVia: row.granted_via,
    id: row.id,
    profileId: row.profile_id,
    resourceId: row.resource_id,
    revokedAt: row.revoked_at,
    shareLinkId: row.share_link_id,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toStoredResourceFolderItem(
  row: ResourceFolderItemRow,
): StoredResourceFolderItem {
  return {
    createdAt: row.item_created_at,
    folderId: row.folder_id,
    position: row.position,
    resource: toStoredResource(row),
    resourceId: row.resource_id,
    resourceType: row.resource_type,
    updatedAt: row.item_updated_at,
  };
}

function toStoredResourceFolderMoveOption(
  row: ResourceFolderMoveOptionRow,
): StoredResourceFolderMoveOption {
  return {
    ...toStoredResource(row),
    parentFolderId: row.parent_folder_id,
  };
}

function toStoredResourceShareLink(row: ResourceShareLinkRow): StoredResourceShareLink {
  return {
    createdAt: row.created_at,
    id: row.id,
    resourceId: row.resource_id,
    revokedAt: row.revoked_at,
  };
}

function parseTutorConversationReportData(
  reportJson: string,
): StoredTutorConversationReportData {
  try {
    const parsed = JSON.parse(reportJson) as StoredTutorConversationReportData;
    return {
      difficultyAreas: Array.isArray(parsed.difficultyAreas) ? parsed.difficultyAreas : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
      practicedTopics: Array.isArray(parsed.practicedTopics) ? parsed.practicedTopics : [],
      progressHighlights: Array.isArray(parsed.progressHighlights) ? parsed.progressHighlights : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      usefulPhrases: Array.isArray(parsed.usefulPhrases) ? parsed.usefulPhrases : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
    };
  } catch {
    return {
      difficultyAreas: [],
      nextSteps: [],
      practicedTopics: [],
      progressHighlights: [],
      recommendations: [],
      usefulPhrases: [],
      vocabulary: [],
    };
  }
}

function toStoredTutorConversationReport(
  row: TutorConversationReportRow,
): StoredTutorConversationReport {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    profileId: row.profile_id,
    summaryTitle: row.summary_title,
    summaryDescription: row.summary_description,
    report: parseTutorConversationReportData(row.report_json),
    practiceGuideId: row.practice_guide_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredConversationChatRoomReportSnapshot(
  row: ConversationChatRoomReportSnapshotRow,
): StoredConversationChatRoomReportSnapshot {
  return {
    chatRoomConversationId: row.chat_room_conversation_id,
    chatRoomConversationReportId: row.chat_room_conversation_report_id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    reportSummaryDescription: row.report_summary_description,
    reportSummaryTitle: row.report_summary_title,
    roomDescription: row.room_description,
    roomTitle: row.room_title,
    slidesJson: row.slides_json,
  };
}

function toStoredConversationTutorReportSnapshot(
  row: ConversationTutorReportSnapshotRow,
): StoredConversationTutorReportSnapshot {
  return {
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    reportJson: row.report_json,
    reportSummaryDescription: row.report_summary_description,
    reportSummaryTitle: row.report_summary_title,
    sourceConversationId: row.source_conversation_id,
    tutorConversationReportId: row.tutor_conversation_report_id,
  };
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null | undefined): unknown[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseQuizAuthoringMessages(
  value: string | null | undefined,
): QuizAuthoringMessage[] {
  return parseJsonArray(value)
    .flatMap((item): QuizAuthoringMessage[] => {
      if (!isPlainRecord(item)) {
        return [];
      }

      const role = item.role;
      const content = typeof item.content === 'string' ? item.content.trim() : '';
      if ((role !== 'assistant' && role !== 'user') || !content) {
        return [];
      }

      return [{
        content,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt.trim() : '',
        draftSnapshot: isPlainRecord(item.draftSnapshot) ? item.draftSnapshot : undefined,
        role,
      }];
    })
    .slice(-50);
}

function parseStringArray(value: string | null | undefined, maxItemLength = 180): string[] {
  return parseJsonArray(value)
    .flatMap((item): string[] => {
      if (typeof item !== 'string') {
        return [];
      }

      const normalized = item.replace(/\s+/g, ' ').trim().slice(0, maxItemLength);
      return normalized ? [normalized] : [];
    })
    .slice(0, 24);
}

function parseRoleplayAuthoringMessages(
  value: string | null | undefined,
): RoleplayAuthoringMessage[] {
  return parseJsonArray(value)
    .flatMap((item): RoleplayAuthoringMessage[] => {
      if (!isPlainRecord(item)) {
        return [];
      }

      const role = item.role;
      const content = typeof item.content === 'string' ? item.content.trim() : '';
      if ((role !== 'assistant' && role !== 'user') || !content) {
        return [];
      }

      return [{
        content,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt.trim() : '',
        draftSnapshot: isPlainRecord(item.draftSnapshot) ? item.draftSnapshot : undefined,
        role,
      }];
    })
    .slice(-50);
}

function parseRoleplayCharacters(value: string | null | undefined): RoleplayCharacter[] {
  return parseJsonArray(value)
    .flatMap((item): RoleplayCharacter[] => {
      if (!isPlainRecord(item)) {
        return [];
      }

      const id = readStringFromRecord(item, 'id').slice(0, 64);
      const name = readStringFromRecord(item, 'name').slice(0, 120);
      if (!id || !name) {
        return [];
      }

      return [{
        description: readStringFromRecord(item, 'description').slice(0, 1200),
        id,
        name,
      }];
    })
    .slice(0, 2);
}

function parseRoleplayTurns(value: string | null | undefined): RoleplayTurn[] {
  return parseJsonArray(value)
    .flatMap((item): RoleplayTurn[] => {
      if (!isPlainRecord(item)) {
        return [];
      }

      const speaker = item.speaker === 'ai' || item.speaker === 'learner'
        ? item.speaker
        : null;
      const text = readStringFromRecord(item, 'text').slice(0, 4000);
      if (!speaker || !text) {
        return [];
      }

      return [{
        characterId: readStringFromRecord(item, 'characterId').slice(0, 64),
        createdAt: readStringFromRecord(item, 'createdAt') || new Date().toISOString(),
        speaker,
        text,
      }];
    })
    .slice(0, 80);
}

function toStoredQuiz(row: QuizRow): StoredQuiz {
  return {
    allowPublicAttempts: row.allow_public_attempts === 1,
    archivedAt: row.archived_at,
    authoringMessages: parseQuizAuthoringMessages(row.authoring_messages_json),
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    instructions: row.instructions,
    level: row.level,
    profileId: row.profile_id,
    quiz: parseJsonRecord(row.quiz_json),
    sharedVia: row.shared_via,
    sourceQuizId: row.source_quiz_id,
    sourceProfileId: row.source_profile_id,
    sourceUserId: row.source_user_id,
    targetTopic: row.target_topic,
    title: row.title,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toStoredQuizShareLink(
  row: QuizShareLinkRow,
): StoredQuizShareLink {
  return {
    quizId: row.quiz_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredQuizAttempt(row: QuizAttemptRow): StoredQuizAttempt {
  return {
    quizId: row.quiz_id,
    claimToken: row.claim_token,
    createdAt: row.created_at,
    evaluatedAt: row.evaluated_at,
    guestToken: row.guest_token,
    id: row.id,
    profileId: row.profile_id,
    progressEventId: row.progress_event_id,
    responses: parseJsonArray(row.responses_json),
    result: row.result_json ? parseJsonRecord(row.result_json) : null,
    snapshot: parseJsonRecord(row.snapshot_json),
    startedAt: row.started_at,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toStoredConversationQuizAttemptSnapshot(
  row: ConversationQuizAttemptSnapshotRow,
): StoredConversationQuizAttemptSnapshot {
  return {
    quizAttemptId: row.quiz_attempt_id,
    quizDescription: row.quiz_description,
    quizSnapshot: parseJsonRecord(row.quiz_snapshot_json),
    quizTargetTopic: row.quiz_target_topic,
    quizTitle: row.quiz_title,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    responses: parseJsonArray(row.responses_json),
    result: parseJsonRecord(row.result_json),
  };
}

function toStoredRoleplay(row: RoleplayRow): StoredRoleplay {
  return {
    archivedAt: row.archived_at,
    authoringMessages: parseRoleplayAuthoringMessages(row.authoring_messages_json),
    characters: parseRoleplayCharacters(row.characters_json),
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    level: row.level,
    maxLearnerTurns: row.max_learner_turns,
    pedagogicalFocus: row.pedagogical_focus,
    profileId: row.profile_id,
    scenario: row.scenario,
    sharedVia: row.shared_via,
    sourceProfileId: row.source_profile_id,
    sourceRoleplayId: row.source_roleplay_id,
    sourceUserId: row.source_user_id,
    title: row.title,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toStoredRoleplayAttempt(row: RoleplayAttemptRow): StoredRoleplayAttempt {
  return {
    createdAt: row.created_at,
    evaluatedAt: row.evaluated_at,
    id: row.id,
    profileId: row.profile_id,
    progressEventId: row.progress_event_id,
    result: row.result_json ? parseJsonRecord(row.result_json) : null,
    roleplayId: row.roleplay_id,
    snapshot: parseJsonRecord(row.snapshot_json),
    startedAt: row.started_at,
    status: row.status,
    submittedAt: row.submitted_at,
    turns: parseRoleplayTurns(row.turns_json),
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toStoredConversationRoleplayAttemptSnapshot(
  row: ConversationRoleplayAttemptSnapshotRow,
): StoredConversationRoleplayAttemptSnapshot {
  return {
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    result: parseJsonRecord(row.result_json),
    roleplayAttemptId: row.roleplay_attempt_id,
    roleplayDescription: row.roleplay_description,
    roleplaySnapshot: parseJsonRecord(row.roleplay_snapshot_json),
    roleplayTitle: row.roleplay_title,
    turns: parseRoleplayTurns(row.turns_json),
  };
}

function parseLearnerProgressSummary(summaryJson: string): StoredLearnerProgressSummary {
  const fallback: StoredLearnerProgressSummary = {
    focusAreas: [],
    overview: '',
    recommendedPractice: [],
    strengths: [],
    updatedFromEvents: 0,
    vocabulary: [],
  };

  try {
    const parsed = JSON.parse(summaryJson) as Partial<StoredLearnerProgressSummary>;
    return {
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas : [],
      overview: typeof parsed.overview === 'string' ? parsed.overview : '',
      recommendedPractice: Array.isArray(parsed.recommendedPractice)
        ? parsed.recommendedPractice
        : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      updatedFromEvents:
        typeof parsed.updatedFromEvents === 'number' ? parsed.updatedFromEvents : 0,
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
    };
  } catch {
    return fallback;
  }
}

function parseLearnerProgressEventDetails(
  detailsJson: string,
): StoredLearnerProgressEventDetails {
  const fallback: StoredLearnerProgressEventDetails = {
    difficulties: [],
    practiced: [],
    progress: [],
    recommendations: [],
    vocabulary: [],
  };

  try {
    const parsed = JSON.parse(detailsJson) as Partial<StoredLearnerProgressEventDetails>;
    const resourceType = typeof parsed.resourceType === 'string' && isKnownResourceType(parsed.resourceType)
      ? parsed.resourceType
      : undefined;
    return {
      difficulties: Array.isArray(parsed.difficulties) ? parsed.difficulties : [],
      practiced: Array.isArray(parsed.practiced) ? parsed.practiced : [],
      progress: Array.isArray(parsed.progress) ? parsed.progress : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      ...(typeof parsed.resourceId === 'string' && parsed.resourceId
        ? { resourceId: parsed.resourceId }
        : {}),
      ...(resourceType ? { resourceType } : {}),
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
    };
  } catch {
    return fallback;
  }
}

function isKnownResourceType(value: string): value is ResourceType {
  return (
    value === 'quiz' ||
    value === 'practice_guide' ||
    value === 'resource_folder' ||
    value === 'roleplay'
  );
}

function toStoredLearnerProgressProfile(
  row: LearnerProgressProfileRow,
): StoredLearnerProgressProfile {
  return {
    id: row.id,
    profileId: row.profile_id,
    summary: parseLearnerProgressSummary(row.summary_json),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredLearnerProgressEvent(
  row: LearnerProgressEventRow,
): StoredLearnerProgressEvent {
  return {
    id: row.id,
    details: parseLearnerProgressEventDetails(row.details_json),
    eventDate: row.event_date,
    profileId: row.profile_id,
    sourceId: row.source_id,
    sourceType: row.source_type,
    summary: row.summary,
    title: row.title,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoom(row: ChatRoomRow): StoredChatRoom {
  return {
    archivedAt: row.archived_at,
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourceRoomId: row.source_room_id,
    sourceProfileId: row.source_profile_id,
    sourceUserId: row.source_user_id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoomShareLink(
  row: ChatRoomShareLinkRow,
): StoredChatRoomShareLink {
  return {
    roomId: row.room_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredChatRoomCharacter(
  row: ChatRoomCharacterRow,
): StoredChatRoomCharacter {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoomConversation(
  row: ChatRoomConversationRow,
): StoredChatRoomConversation {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    profileId: row.profile_id,
    reportCreatedAt: row.report_created_at,
    reportId: row.report_id,
    reportPracticeGuideId: row.report_practice_guide_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseChatRoomConversationReportSlides(
  slidesJson: string,
): StoredChatRoomConversationReportSlide[] {
  try {
    const parsed = JSON.parse(slidesJson) as unknown;
    return Array.isArray(parsed)
      ? (parsed as StoredChatRoomConversationReportSlide[])
      : [];
  } catch {
    return [];
  }
}

function toStoredChatRoomConversationReport(
  row: ChatRoomConversationReportRow,
): StoredChatRoomConversationReport {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    roomId: row.room_id,
    userId: row.user_id,
    profileId: row.profile_id,
    summaryTitle: row.summary_title,
    summaryDescription: row.summary_description,
    slides: parseChatRoomConversationReportSlides(row.slides_json),
    practiceGuideId: row.practice_guide_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoomMessage(
  row: ChatRoomMessageRow,
): StoredChatRoomMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderName: row.sender_name,
    content: row.content,
    evaluationStatus: row.evaluation_status,
    evaluationProblem: row.evaluation_problem,
    evaluationCreatedAt: row.evaluation_created_at,
    createdAt: row.created_at,
  };
}

function toStoredPracticeGuide(row: PracticeGuideRow): StoredPracticeGuide {
  return {
    archivedAt: row.archived_at,
    id: row.id,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourcePracticeGuideId: row.source_practice_guide_id,
    sourceProfileId: row.source_profile_id,
    sourceUserId: row.source_user_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    tutorInstructions: row.tutor_instructions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredPracticeGuideShareLink(
  row: PracticeGuideShareLinkRow,
): StoredPracticeGuideShareLink {
  return {
    practiceGuideId: row.practice_guide_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredConversationPracticeGuideSnapshot(
  row: ConversationPracticeGuideSnapshotRow,
): StoredConversationPracticeGuideSnapshot {
  return {
    practiceGuideId: row.practice_guide_id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    description: row.description,
    title: row.title,
    tutorInstructions: row.tutor_instructions,
  };
}

function toStoredMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata ? parseMetadata(row.metadata) : null,
    createdAt: row.created_at,
  };
}

function toStoredTutorPlan(row: ConversationTutorPlanRow): StoredTutorPlan | null {
  const parsed = parseTutorPlanJson(row.plan_json);
  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function insertResource(
  db: ReturnType<typeof getDb>,
  input: {
    archivedAt?: string | null;
    description?: string;
    id: string;
    level?: string;
    profileId: string;
    sharedVia?: ResourceShareKind | null;
    sourceProfileId?: string | null;
    sourceResourceId?: string | null;
    sourceUserId?: string | null;
    title: string;
    topic?: string;
    type: ResourceType;
    userId: string;
  },
): void {
  db.prepare(
    `
      INSERT INTO resources (
        id,
        user_id,
        profile_id,
        type,
        title,
        description,
        topic,
        level,
        archived_at,
        source_resource_id,
        source_user_id,
        source_profile_id,
        shared_via
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    input.id,
    input.userId,
    input.profileId,
    input.type,
    input.title,
    input.description ?? '',
    input.topic ?? '',
    input.level ?? '',
    input.archivedAt ?? null,
    input.sourceResourceId ?? null,
    input.sourceUserId ?? null,
    input.sourceProfileId ?? null,
    input.sharedVia ?? null,
  );
}

function updateResourceMetadata(
  db: ReturnType<typeof getDb>,
  input: {
    description: string;
    id: string;
    level?: string;
    title: string;
    topic?: string;
    userId: string;
  },
): void {
  db.prepare(
    `
      UPDATE resources
      SET title = ?,
          description = ?,
          topic = COALESCE(?, topic),
          level = COALESCE(?, level),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
  ).run(
    input.title,
    input.description,
    input.topic ?? null,
    input.level ?? null,
    input.id,
    input.userId,
  );
}

function archiveResource(
  db: ReturnType<typeof getDb>,
  resourceId: string,
  userId: string,
): void {
  db.prepare(
    `
      UPDATE resources
      SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
  ).run(resourceId, userId);
}

function restoreResource(
  db: ReturnType<typeof getDb>,
  resourceId: string,
  userId: string,
): void {
  db.prepare(
    `
      UPDATE resources
      SET archived_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
  ).run(resourceId, userId);
}

function upsertResourceShareLink(
  db: ReturnType<typeof getDb>,
  id: string,
  resourceId: string,
): void {
  db.prepare(
    `
      INSERT INTO resource_share_links (id, resource_id)
      VALUES (?, ?)
      ON CONFLICT(resource_id) DO UPDATE SET
        revoked_at = NULL
    `,
  ).run(id, resourceId);
}

function normalizeResourceFolderPositions(folderId: string): void {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT resource_id
        FROM resource_folder_items
        WHERE folder_id = ?
        ORDER BY position ASC, created_at ASC
      `,
    )
    .all(folderId) as Array<{ resource_id: string }>;

  const update = db.prepare(
    `
      UPDATE resource_folder_items
      SET position = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE folder_id = ? AND resource_id = ?
    `,
  );

  rows.forEach((row, index) => {
    update.run(index + 1, folderId, row.resource_id);
  });
}

export function findResourceForUser(
  resourceId: string,
  userId: string,
): StoredResource | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          profile_id,
          type,
          title,
          description,
          topic,
          level,
          archived_at,
          source_resource_id,
          source_user_id,
          source_profile_id,
          shared_via,
          created_at,
          updated_at
        FROM resources
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(resourceId, userId) as ResourceRow | undefined;

  return row ? toStoredResource(row) : null;
}

export function findResourceById(resourceId: string): StoredResource | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          profile_id,
          type,
          title,
          description,
          topic,
          level,
          archived_at,
          source_resource_id,
          source_user_id,
          source_profile_id,
          shared_via,
          created_at,
          updated_at
        FROM resources
        WHERE id = ?
      `,
    )
    .get(resourceId) as ResourceRow | undefined;

  return row ? toStoredResource(row) : null;
}

export function findResourceAccessForProfile(input: {
  includeArchived?: boolean;
  profileId: string;
  resourceId: string;
  userId: string;
}): StoredAccessibleResource | null {
  const includeArchived = input.includeArchived ? 1 : 0;
  const row = getDb()
    .prepare(
      `
        WITH RECURSIVE ancestor_folders(folder_id) AS (
          SELECT item.folder_id
          FROM resource_folder_items AS item
          WHERE item.resource_id = ?

          UNION ALL

          SELECT item.folder_id
          FROM resource_folder_items AS item
          JOIN ancestor_folders AS ancestor
            ON ancestor.folder_id = item.resource_id
        ),
        candidates AS (
          SELECT
            resource.id,
            resource.user_id,
            resource.profile_id,
            resource.type,
            resource.title,
            resource.description,
            resource.topic,
            resource.level,
            resource.archived_at,
            resource.source_resource_id,
            resource.source_user_id,
            resource.source_profile_id,
            resource.shared_via,
            resource.created_at,
            resource.updated_at,
            'owner' AS access_kind,
            NULL AS grant_id,
            NULL AS granted_via,
            NULL AS share_link_id,
            NULL AS access_created_at,
            0 AS access_rank
          FROM resources AS resource
          WHERE resource.id = ?
            AND resource.user_id = ?
            AND resource.profile_id = ?

          UNION ALL

          SELECT
            resource.id,
            resource.user_id,
            resource.profile_id,
            resource.type,
            resource.title,
            resource.description,
            resource.topic,
            resource.level,
            resource.archived_at,
            resource.source_resource_id,
            resource.source_user_id,
            resource.source_profile_id,
            resource.shared_via,
            resource.created_at,
            resource.updated_at,
            'shared' AS access_kind,
            grant_row.id AS grant_id,
            grant_row.granted_via,
            grant_row.share_link_id,
            grant_row.created_at AS access_created_at,
            1 AS access_rank
          FROM resource_access_grants AS grant_row
          JOIN resources AS resource
            ON resource.id = grant_row.resource_id
          LEFT JOIN resource_share_links AS share_link
            ON share_link.id = grant_row.share_link_id
          WHERE grant_row.resource_id = ?
            AND grant_row.user_id = ?
            AND grant_row.profile_id = ?
            AND grant_row.revoked_at IS NULL
            AND (grant_row.share_link_id IS NULL OR share_link.revoked_at IS NULL)

          UNION ALL

          SELECT
            resource.id,
            resource.user_id,
            resource.profile_id,
            resource.type,
            resource.title,
            resource.description,
            resource.topic,
            resource.level,
            resource.archived_at,
            resource.source_resource_id,
            resource.source_user_id,
            resource.source_profile_id,
            resource.shared_via,
            resource.created_at,
            resource.updated_at,
            'shared' AS access_kind,
            grant_row.id AS grant_id,
            grant_row.granted_via,
            grant_row.share_link_id,
            grant_row.created_at AS access_created_at,
            2 AS access_rank
          FROM resources AS resource
          JOIN ancestor_folders AS ancestor
          JOIN resource_access_grants AS grant_row
            ON grant_row.resource_id = ancestor.folder_id
          LEFT JOIN resource_share_links AS share_link
            ON share_link.id = grant_row.share_link_id
          WHERE resource.id = ?
            AND grant_row.user_id = ?
            AND grant_row.profile_id = ?
            AND grant_row.revoked_at IS NULL
            AND (grant_row.share_link_id IS NULL OR share_link.revoked_at IS NULL)
        )
        SELECT
          id,
          user_id,
          profile_id,
          type,
          title,
          description,
          topic,
          level,
          archived_at,
          source_resource_id,
          source_user_id,
          source_profile_id,
          shared_via,
          created_at,
          updated_at,
          access_kind,
          grant_id,
          granted_via,
          share_link_id,
          access_created_at
        FROM candidates
        WHERE (? = 1 OR archived_at IS NULL)
        ORDER BY access_rank ASC
        LIMIT 1
      `,
    )
    .get(
      input.resourceId,
      input.resourceId,
      input.userId,
      input.profileId,
      input.resourceId,
      input.userId,
      input.profileId,
      input.resourceId,
      input.userId,
      input.profileId,
      includeArchived,
    ) as AccessibleResourceRow | undefined;

  return row ? toStoredAccessibleResource(row) : null;
}

export function findResourceFolderForResource(
  resourceId: string,
  userId: string,
): StoredResource | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          folder.id,
          folder.user_id,
          folder.profile_id,
          folder.type,
          folder.title,
          folder.description,
          folder.topic,
          folder.level,
          folder.archived_at,
          folder.source_resource_id,
          folder.source_user_id,
          folder.source_profile_id,
          folder.shared_via,
          folder.created_at,
          folder.updated_at
        FROM resource_folder_items AS item
        JOIN resources AS folder
          ON folder.id = item.folder_id
        JOIN resources AS resource
          ON resource.id = item.resource_id
        WHERE item.resource_id = ?
          AND resource.user_id = ?
          AND folder.user_id = ?
          AND folder.type = 'resource_folder'
          AND folder.archived_at IS NULL
        LIMIT 1
      `,
    )
    .get(resourceId, userId, userId) as ResourceRow | undefined;

  return row ? toStoredResource(row) : null;
}

export function listResourceFolderPath(
  folderId: string,
  userId: string,
): StoredResource[] {
  const path: StoredResource[] = [];
  const seenFolderIds = new Set<string>();
  let currentFolder = findResourceForUser(folderId, userId);

  while (currentFolder?.type === 'resource_folder' && !seenFolderIds.has(currentFolder.id)) {
    path.unshift(currentFolder);
    seenFolderIds.add(currentFolder.id);
    currentFolder = findResourceFolderForResource(currentFolder.id, userId);
  }

  return path;
}

export function listAccessibleResourceFolderPath(input: {
  includeArchived?: boolean;
  folderId: string;
  profileId: string;
  userId: string;
}): StoredAccessibleResource[] {
  const selectedFolder = findResourceAccessForProfile({
    includeArchived: input.includeArchived,
    profileId: input.profileId,
    resourceId: input.folderId,
    userId: input.userId,
  });
  if (selectedFolder?.type !== 'resource_folder') {
    return [];
  }

  return listResourceFolderPath(selectedFolder.id, selectedFolder.userId)
    .map((folder) =>
      findResourceAccessForProfile({
        includeArchived: input.includeArchived,
        profileId: input.profileId,
        resourceId: folder.id,
        userId: input.userId,
      }),
    )
    .filter((folder): folder is StoredAccessibleResource => (
      folder?.type === 'resource_folder'
    ));
}

export function listResourceFolderPathForResource(
  resourceId: string,
  userId: string,
): StoredResource[] {
  const parentFolder = findResourceFolderForResource(resourceId, userId);
  return parentFolder ? listResourceFolderPath(parentFolder.id, userId) : [];
}

export function listResourceFolderDescendantIds(
  folderId: string,
  userId: string,
): string[] {
  const rows = getDb()
    .prepare(
      `
        WITH RECURSIVE folder_descendants(id) AS (
          SELECT item.resource_id
          FROM resource_folder_items AS item
          JOIN resources AS resource
            ON resource.id = item.resource_id
          WHERE item.folder_id = ?
            AND resource.user_id = ?
            AND resource.type = 'resource_folder'
            AND resource.archived_at IS NULL

          UNION ALL

          SELECT item.resource_id
          FROM resource_folder_items AS item
          JOIN resources AS resource
            ON resource.id = item.resource_id
          JOIN folder_descendants AS descendant
            ON descendant.id = item.folder_id
          WHERE resource.user_id = ?
            AND resource.type = 'resource_folder'
            AND resource.archived_at IS NULL
        )
        SELECT id
        FROM folder_descendants
      `,
    )
    .all(folderId, userId, userId) as Array<{ id: string }>;

  return rows.map((row) => row.id);
}

export function listResourceFoldersForProfile(input: {
  includeArchived?: boolean;
  profileId: string;
  userId: string;
}): StoredResourceFolderMoveOption[] {
  const includeArchived = input.includeArchived ? 1 : 0;
  const rows = getDb()
    .prepare(
      `
        SELECT
          folder.id,
          folder.user_id,
          folder.profile_id,
          folder.type,
          folder.title,
          folder.description,
          folder.topic,
          folder.level,
          folder.archived_at,
          folder.source_resource_id,
          folder.source_user_id,
          folder.source_profile_id,
          folder.shared_via,
          folder.created_at,
          folder.updated_at,
          item.folder_id AS parent_folder_id
        FROM resources AS folder
        LEFT JOIN resource_folder_items AS item
          ON item.resource_id = folder.id
        WHERE folder.user_id = ?
          AND folder.profile_id = ?
          AND folder.type = 'resource_folder'
          AND (? = 1 OR folder.archived_at IS NULL)
        ORDER BY folder.title ASC, folder.created_at ASC
      `,
    )
    .all(input.userId, input.profileId, includeArchived) as ResourceFolderMoveOptionRow[];

  return rows.map(toStoredResourceFolderMoveOption);
}

export function listResourcesForProfile(input: {
  folderId?: string | null;
  includeArchived?: boolean;
  profileId: string;
  type?: ResourceType | null;
  userId: string;
}): StoredAccessibleResource[] {
  const includeArchived = input.includeArchived ? 1 : 0;
  if (input.folderId) {
    const folderAccess = findResourceAccessForProfile({
      includeArchived: input.includeArchived,
      profileId: input.profileId,
      resourceId: input.folderId,
      userId: input.userId,
    });
    if (folderAccess?.type !== 'resource_folder') {
      return [];
    }

    const rows = getDb()
      .prepare(
        `
          SELECT
            resource.id,
            resource.user_id,
            resource.profile_id,
            resource.type,
            resource.title,
            resource.description,
            resource.topic,
            resource.level,
            resource.archived_at,
            resource.source_resource_id,
            resource.source_user_id,
            resource.source_profile_id,
            resource.shared_via,
            resource.created_at,
            resource.updated_at,
            CASE
              WHEN resource.user_id = ? AND resource.profile_id = ? THEN 'owner'
              ELSE 'shared'
            END AS access_kind,
            CASE
              WHEN resource.user_id = ? AND resource.profile_id = ? THEN NULL
              ELSE ?
            END AS grant_id,
            CASE
              WHEN resource.user_id = ? AND resource.profile_id = ? THEN NULL
              ELSE ?
            END AS granted_via,
            CASE
              WHEN resource.user_id = ? AND resource.profile_id = ? THEN NULL
              ELSE ?
            END AS share_link_id,
            CASE
              WHEN resource.user_id = ? AND resource.profile_id = ? THEN NULL
              ELSE ?
            END AS access_created_at
          FROM resource_folder_items AS item
          JOIN resources AS resource
            ON resource.id = item.resource_id
          JOIN resources AS folder
            ON folder.id = item.folder_id
          WHERE item.folder_id = ?
            AND (? IS NULL OR resource.type = ?)
            AND (? = 1 OR resource.archived_at IS NULL)
          ORDER BY item.position ASC, item.created_at ASC
        `,
      )
      .all(
        input.userId,
        input.profileId,
        input.userId,
        input.profileId,
        folderAccess.grantId,
        input.userId,
        input.profileId,
        folderAccess.grantedVia,
        input.userId,
        input.profileId,
        folderAccess.shareLinkId,
        input.userId,
        input.profileId,
        folderAccess.accessCreatedAt,
        input.folderId,
        input.type ?? null,
        input.type ?? null,
        includeArchived,
      ) as AccessibleResourceRow[];

    return rows.map(toStoredAccessibleResource);
  }

  const rows = getDb()
    .prepare(
      `
        SELECT *
        FROM (
          SELECT
            resource.id,
            resource.user_id,
            resource.profile_id,
            resource.type,
            resource.title,
            resource.description,
            resource.topic,
            resource.level,
            resource.archived_at,
            resource.source_resource_id,
            resource.source_user_id,
            resource.source_profile_id,
            resource.shared_via,
            resource.created_at,
            resource.updated_at,
            'owner' AS access_kind,
            NULL AS grant_id,
            NULL AS granted_via,
            NULL AS share_link_id,
            NULL AS access_created_at,
            0 AS access_rank
          FROM resources AS resource
          WHERE resource.user_id = ?
            AND resource.profile_id = ?
            AND (? IS NULL OR resource.type = ?)
            AND (? = 1 OR resource.archived_at IS NULL)

          UNION ALL

          SELECT
            resource.id,
            resource.user_id,
            resource.profile_id,
            resource.type,
            resource.title,
            resource.description,
            resource.topic,
            resource.level,
            resource.archived_at,
            resource.source_resource_id,
            resource.source_user_id,
            resource.source_profile_id,
            resource.shared_via,
            resource.created_at,
            resource.updated_at,
            'shared' AS access_kind,
            grant_row.id AS grant_id,
            grant_row.granted_via,
            grant_row.share_link_id,
            grant_row.created_at AS access_created_at,
            1 AS access_rank
          FROM resource_access_grants AS grant_row
          JOIN resources AS resource
            ON resource.id = grant_row.resource_id
          LEFT JOIN resource_share_links AS share_link
            ON share_link.id = grant_row.share_link_id
          WHERE grant_row.user_id = ?
            AND grant_row.profile_id = ?
            AND grant_row.revoked_at IS NULL
            AND (grant_row.share_link_id IS NULL OR share_link.revoked_at IS NULL)
            AND (? IS NULL OR resource.type = ?)
            AND (? = 1 OR resource.archived_at IS NULL)
        )
        ORDER BY
          CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END ASC,
          access_rank ASC,
          updated_at DESC,
          created_at DESC
      `,
    )
    .all(
      input.userId,
      input.profileId,
      input.type ?? null,
      input.type ?? null,
      includeArchived,
      input.userId,
      input.profileId,
      input.type ?? null,
      input.type ?? null,
      includeArchived,
    ) as AccessibleResourceRow[];

  const uniqueResources = new Map<string, StoredAccessibleResource>();
  for (const row of rows.map(toStoredAccessibleResource)) {
    if (!uniqueResources.has(row.id)) {
      uniqueResources.set(row.id, row);
    }
  }

  return Array.from(uniqueResources.values());
}

export function createResourceFolder(input: {
  description?: string;
  profileId: string;
  title: string;
  userId: string;
}): StoredResource {
  const id = randomUUID();
  const db = getDb();
  const transaction = db.transaction(() => {
    insertResource(db, {
      description: input.description ?? '',
      id,
      profileId: input.profileId,
      title: input.title,
      type: 'resource_folder',
      userId: input.userId,
    });
    db.prepare('INSERT INTO resource_folders (id) VALUES (?)').run(id);
  });

  transaction();

  const folder = findResourceForUser(id, input.userId);
  if (!folder) {
    throw new Error('Could not load newly created resource folder.');
  }

  return folder;
}

export function updateResourceFolder(input: {
  description: string;
  folderId: string;
  title: string;
  userId: string;
}): StoredResource | null {
  const folder = findResourceForUser(input.folderId, input.userId);
  if (folder?.type !== 'resource_folder') {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    updateResourceMetadata(db, {
      description: input.description,
      id: input.folderId,
      title: input.title,
      userId: input.userId,
    });
  });

  transaction();
  return findResourceForUser(input.folderId, input.userId);
}

export function archiveResourceForUser(
  resourceId: string,
  userId: string,
): StoredResource | null {
  const resource = findResourceForUser(resourceId, userId);
  if (!resource) {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    archiveResource(db, resourceId, userId);
    if (resource.type === 'quiz') {
      db.prepare(
        `
          UPDATE quizzes
          SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `,
      ).run(resourceId, userId);
    } else if (resource.type === 'practice_guide') {
      db.prepare(
        `
          UPDATE practice_guides
          SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `,
      ).run(resourceId, userId);
    } else if (resource.type === 'roleplay') {
      db.prepare(
        `
          UPDATE roleplays
          SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `,
      ).run(resourceId, userId);
    }
  });

  transaction();
  return findResourceForUser(resourceId, userId);
}

export function restoreResourceForUser(
  resourceId: string,
  userId: string,
): StoredResource | null {
  const resource = findResourceForUser(resourceId, userId);
  if (!resource) {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    restoreResource(db, resourceId, userId);
    if (resource.type === 'quiz') {
      db.prepare(
        `
          UPDATE quizzes
          SET archived_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `,
      ).run(resourceId, userId);
    } else if (resource.type === 'practice_guide') {
      db.prepare(
        `
          UPDATE practice_guides
          SET archived_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `,
      ).run(resourceId, userId);
    } else if (resource.type === 'roleplay') {
      db.prepare(
        `
          UPDATE roleplays
          SET archived_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `,
      ).run(resourceId, userId);
    }
  });

  transaction();
  return findResourceForUser(resourceId, userId);
}

export function addResourceToFolder(input: {
  folderId: string;
  resourceId: string;
  userId: string;
}): boolean {
  const folder = findResourceForUser(input.folderId, input.userId);
  const resource = findResourceForUser(input.resourceId, input.userId);
  if (
    folder?.type !== 'resource_folder'
    || !resource
    || folder.archivedAt
    || resource.archivedAt
    || folder.profileId !== resource.profileId
  ) {
    return false;
  }

  const db = getDb();
  const previous = db
    .prepare('SELECT folder_id FROM resource_folder_items WHERE resource_id = ?')
    .get(input.resourceId) as { folder_id: string } | undefined;
  if (previous?.folder_id === input.folderId) {
    return false;
  }

  if (resource.type === 'resource_folder') {
    if (resource.id === folder.id) {
      return false;
    }

    const descendantFolderIds = new Set(
      listResourceFolderDescendantIds(resource.id, input.userId),
    );
    if (descendantFolderIds.has(folder.id)) {
      return false;
    }
  }

  const nextPositionRow = db
    .prepare(
      `
        SELECT COALESCE(MAX(position), 0) AS max_position
        FROM resource_folder_items
        WHERE folder_id = ?
      `,
    )
    .get(input.folderId) as { max_position: number };

  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO resource_folder_items (
          folder_id,
          resource_id,
          resource_type,
          position
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(resource_id) DO UPDATE SET
          folder_id = excluded.folder_id,
          resource_type = excluded.resource_type,
          position = excluded.position,
          updated_at = CURRENT_TIMESTAMP
      `,
    ).run(
      input.folderId,
      input.resourceId,
      resource.type,
      nextPositionRow.max_position + 1,
    );
    db.prepare(
      `
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id IN (?, ?)
      `,
    ).run(input.folderId, input.resourceId);
  });

  transaction();
  if (previous?.folder_id && previous.folder_id !== input.folderId) {
    normalizeResourceFolderPositions(previous.folder_id);
  }
  normalizeResourceFolderPositions(input.folderId);

  return true;
}

export function removeResourceFromFolder(input: {
  folderId: string;
  resourceId: string;
  userId: string;
}): boolean {
  const folder = findResourceForUser(input.folderId, input.userId);
  const resource = findResourceForUser(input.resourceId, input.userId);
  if (folder?.type !== 'resource_folder' || !resource) {
    return false;
  }

  const result = getDb()
    .prepare(
      `
        DELETE FROM resource_folder_items
        WHERE folder_id = ? AND resource_id = ?
      `,
    )
    .run(input.folderId, input.resourceId);

  if (result.changes < 1) {
    return false;
  }

  normalizeResourceFolderPositions(input.folderId);
  return true;
}

export function listResourceFolderItems(
  folderId: string,
  userId: string,
): StoredResourceFolderItem[] {
  const folder = findResourceForUser(folderId, userId);
  if (folder?.type !== 'resource_folder') {
    return [];
  }

  const rows = getDb()
    .prepare(
      `
        SELECT
          item.folder_id,
          item.resource_id,
          item.resource_type,
          item.position,
          item.created_at AS item_created_at,
          item.updated_at AS item_updated_at,
          resource.id,
          resource.user_id,
          resource.profile_id,
          resource.type,
          resource.title,
          resource.description,
          resource.topic,
          resource.level,
          resource.archived_at,
          resource.source_resource_id,
          resource.source_user_id,
          resource.source_profile_id,
          resource.shared_via,
          resource.created_at,
          resource.updated_at
        FROM resource_folder_items AS item
        JOIN resources AS resource
          ON resource.id = item.resource_id
        WHERE item.folder_id = ?
          AND resource.user_id = ?
        ORDER BY item.position ASC, item.created_at ASC
      `,
    )
    .all(folderId, userId) as ResourceFolderItemRow[];

  return rows.map(toStoredResourceFolderItem);
}

export function moveResourceFolderItem(input: {
  direction: 'down' | 'up';
  folderId: string;
  resourceId: string;
  userId: string;
}): boolean {
  const items = listResourceFolderItems(input.folderId, input.userId);
  const index = items.findIndex((item) => item.resourceId === input.resourceId);
  if (index < 0) {
    return false;
  }

  const swapIndex = input.direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= items.length) {
    return false;
  }

  const current = items[index];
  const other = items[swapIndex];
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE resource_folder_items
        SET position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE folder_id = ? AND resource_id = ?
      `,
    ).run(-1, input.folderId, current.resourceId);

    db.prepare(
      `
        UPDATE resource_folder_items
        SET position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE folder_id = ? AND resource_id = ?
      `,
    ).run(current.position, input.folderId, other.resourceId);

    db.prepare(
      `
        UPDATE resource_folder_items
        SET position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE folder_id = ? AND resource_id = ?
      `,
    ).run(other.position, input.folderId, current.resourceId);

    db.prepare(
      `
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(input.folderId);
  });

  transaction();
  return true;
}

export function findResourceShareLinkById(
  id: string,
): StoredResourceShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, resource_id, created_at, revoked_at
        FROM resource_share_links
        WHERE id = ?
      `,
    )
    .get(id) as ResourceShareLinkRow | undefined;

  return row ? toStoredResourceShareLink(row) : null;
}

export function findResourceShareLinkForResource(
  resourceId: string,
): StoredResourceShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, resource_id, created_at, revoked_at
        FROM resource_share_links
        WHERE resource_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(resourceId) as ResourceShareLinkRow | undefined;

  return row ? toStoredResourceShareLink(row) : null;
}

export function getOrCreateResourceShareLink(
  resourceId: string,
): StoredResourceShareLink {
  const existing = findResourceShareLinkForResource(resourceId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  upsertResourceShareLink(getDb(), id, resourceId);

  const created = findResourceShareLinkForResource(resourceId);
  if (!created) {
    throw new Error('Could not load newly created resource share link.');
  }

  return created;
}

export function findResourceAccessGrant(input: {
  profileId: string;
  resourceId: string;
  userId: string;
}): StoredResourceAccessGrant | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          resource_id,
          user_id,
          profile_id,
          granted_by_user_id,
          granted_via,
          share_link_id,
          created_at,
          updated_at,
          revoked_at
        FROM resource_access_grants
        WHERE resource_id = ?
          AND user_id = ?
          AND profile_id = ?
        LIMIT 1
      `,
    )
    .get(input.resourceId, input.userId, input.profileId) as
    | ResourceAccessGrantRow
    | undefined;

  return row ? toStoredResourceAccessGrant(row) : null;
}

export function grantResourceAccess(input: {
  grantedByUserId: string;
  grantedVia: ResourceShareKind;
  profileId: string;
  resourceId: string;
  shareLinkId?: string | null;
  userId: string;
}): StoredResourceAccessGrant | null {
  const resource = findResourceById(input.resourceId);
  if (!resource || resource.archivedAt) {
    return null;
  }

  if (resource.userId === input.userId && resource.profileId === input.profileId) {
    return null;
  }

  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO resource_access_grants (
          id,
          resource_id,
          user_id,
          profile_id,
          granted_by_user_id,
          granted_via,
          share_link_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(resource_id, user_id, profile_id) DO UPDATE SET
          granted_by_user_id = excluded.granted_by_user_id,
          granted_via = excluded.granted_via,
          share_link_id = excluded.share_link_id,
          revoked_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(
      id,
      input.resourceId,
      input.userId,
      input.profileId,
      input.grantedByUserId,
      input.grantedVia,
      input.shareLinkId ?? null,
    );

  return findResourceAccessGrant({
    profileId: input.profileId,
    resourceId: input.resourceId,
    userId: input.userId,
  });
}

export function createProfile(input: {
  userId: string;
  name: string;
  description?: string;
  learningContext?: string;
  modelTier?: 'advanced' | 'max' | 'regular';
  profileOnboardingCompleted?: boolean;
}): StoredProfile {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO profiles (
          id,
          user_id,
          name,
          description,
          learning_context,
          model_tier,
          profile_onboarding_completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.userId,
      input.name,
      input.description ?? '',
      input.learningContext ?? '',
      input.modelTier ?? 'regular',
      input.profileOnboardingCompleted === false ? null : new Date().toISOString(),
    );

  const profile = findProfileForUser(id, input.userId);
  if (!profile) {
    throw new Error('Could not load newly created profile.');
  }

  return profile;
}

export function findProfileForUser(
  id: string,
  userId: string,
): StoredProfile | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          name,
          description,
          learning_context,
          model_tier,
          profile_onboarding_completed_at,
          created_at,
          updated_at
        FROM profiles
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ProfileRow | undefined;

  return row ? toStoredProfile(row) : null;
}

export function findProfileById(id: string): StoredProfile | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          name,
          description,
          learning_context,
          model_tier,
          profile_onboarding_completed_at,
          created_at,
          updated_at
        FROM profiles
        WHERE id = ?
      `,
    )
    .get(id) as ProfileRow | undefined;

  return row ? toStoredProfile(row) : null;
}

export function listProfilesForUser(userId: string): StoredProfile[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          name,
          description,
          learning_context,
          model_tier,
          profile_onboarding_completed_at,
          created_at,
          updated_at
        FROM profiles
        WHERE user_id = ?
        ORDER BY created_at ASC, updated_at ASC
      `,
    )
    .all(userId) as ProfileRow[];

  return rows.map(toStoredProfile);
}

export function ensureUserHasProfile(userId: string): StoredProfile {
  const existingProfiles = listProfilesForUser(userId);
  if (existingProfiles.length > 0) {
    return existingProfiles[0];
  }

  return createProfile({
    description: '',
    name: defaultProfileName,
    profileOnboardingCompleted: false,
    userId,
  });
}

export function updateProfile(input: {
  profileId: string;
  userId: string;
  name: string;
  description: string;
  learningContext?: string;
  modelTier?: 'advanced' | 'max' | 'regular';
  profileOnboardingCompleted?: boolean;
}): StoredProfile | null {
  getDb()
    .prepare(
      `
        UPDATE profiles
        SET name = ?,
            description = ?,
            learning_context = COALESCE(?, learning_context),
            model_tier = COALESCE(?, model_tier),
            profile_onboarding_completed_at = CASE
              WHEN ? = 1 THEN COALESCE(profile_onboarding_completed_at, CURRENT_TIMESTAMP)
              ELSE profile_onboarding_completed_at
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(
      input.name,
      input.description,
      input.learningContext ?? null,
      input.modelTier ?? null,
      input.profileOnboardingCompleted ? 1 : 0,
      input.profileId,
      input.userId,
    );

  return findProfileForUser(input.profileId, input.userId);
}

export function markProfileOnboardingCompleted(input: {
  profileId: string;
  userId: string;
}): StoredProfile | null {
  getDb()
    .prepare(
      `
        UPDATE profiles
        SET profile_onboarding_completed_at = COALESCE(
              profile_onboarding_completed_at,
              CURRENT_TIMESTAMP
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(input.profileId, input.userId);

  return findProfileForUser(input.profileId, input.userId);
}

export function updateProfileModelTierForUser(
  profileId: string,
  userId: string,
  modelTier: 'advanced' | 'max' | 'regular',
): StoredProfile | null {
  getDb()
    .prepare(
      `
        UPDATE profiles
        SET model_tier = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(modelTier, profileId, userId);

  return findProfileForUser(profileId, userId);
}

export function createConversation(
  userId: string,
  profileId: string,
  title = defaultConversationTitle,
  options: {
    chatRoomConversationReportId?: string | null;
    modelTier?: 'advanced' | 'max' | 'regular';
    practiceGuideId?: string | null;
  } = {},
): StoredConversation {
  const id = randomUUID();
  const modelTier = options.modelTier ?? findProfileById(profileId)?.modelTier ?? 'regular';
  getDb()
    .prepare(
      `
        INSERT INTO conversations (
          id,
          user_id,
          profile_id,
          title,
          practice_guide_id,
          chat_room_conversation_report_id,
          active_agent,
          model_tier
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      userId,
      profileId,
      title,
      options.practiceGuideId ?? null,
      options.chatRoomConversationReportId ?? null,
      'tutor',
      modelTier,
    );

  const conversation = findConversationForUser(id, userId);
  if (!conversation) {
    throw new Error('Could not load newly created conversation.');
  }

  return conversation;
}

export function createConversationFromPracticeGuide(
  userId: string,
  practiceGuide: StoredPracticeGuide,
  profileId = practiceGuide.profileId,
): StoredConversation {
  const conversation = createConversation(
    userId,
    profileId,
    defaultConversationTitle,
    {
      practiceGuideId: practiceGuide.id,
    },
  );

  createConversationPracticeGuideSnapshot(conversation.id, practiceGuide);
  return conversation;
}

export function createConversationFromChatRoomReport(input: {
  profileId: string;
  report: StoredChatRoomConversationReport;
  room: StoredChatRoom;
  userId: string;
}): StoredConversation {
  const conversation = createConversation(
    input.userId,
    input.profileId,
    defaultConversationTitle,
    {
      chatRoomConversationReportId: input.report.id,
    },
  );

  createConversationChatRoomReportSnapshot(conversation.id, {
    report: input.report,
    room: input.room,
  });

  return conversation;
}

export function createConversationFromTutorReport(input: {
  profileId: string;
  report: StoredTutorConversationReport;
  userId: string;
}): StoredConversation {
  const conversation = createConversation(
    input.userId,
    input.profileId,
    defaultConversationTitle,
  );

  createConversationTutorReportSnapshot(conversation.id, input.report);

  return conversation;
}

export function findConversationForUser(
  id: string,
  userId: string,
): StoredConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_guide_id, profile_id, active_agent
             , model_tier, chat_room_conversation_report_id
        FROM conversations
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ConversationRow | undefined;

  return row ? toStoredConversation(row) : null;
}

export function getOrCreateConversation(
  userId: string,
  profileId: string,
  id?: string | null,
): StoredConversation {
  if (id) {
    const existing = findConversationForUser(id, userId);
    if (existing) {
      return existing;
    }
  }

  return createConversation(userId, profileId);
}

export function touchConversation(conversationId: string): void {
  getDb()
    .prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(conversationId);
}

export function closeConversationForUser(
  conversationId: string,
  userId: string,
): StoredConversation | null {
  getDb()
    .prepare(
      `
        UPDATE conversations
        SET closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(conversationId, userId);

  return findConversationForUser(conversationId, userId);
}

export function listConversationsForProfile(
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_guide_id, profile_id, active_agent
             , model_tier, chat_room_conversation_report_id
        FROM conversations
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function renameConversationForUser(
  id: string,
  userId: string,
  title: string,
  options: { updatedByUser?: boolean } = {},
): StoredConversation | null {
  getDb()
    .prepare(
      `
        UPDATE conversations
        SET title = ?,
            title_updated_by_user = CASE
              WHEN ? THEN 1
              ELSE title_updated_by_user
            END
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(title, options.updatedByUser ? 1 : 0, id, userId);

  return findConversationForUser(id, userId);
}

export function updateConversationModelTierForUser(
  id: string,
  userId: string,
  modelTier: 'advanced' | 'max' | 'regular',
): StoredConversation | null {
  getDb()
    .prepare(
      `
        UPDATE conversations
        SET model_tier = ?
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(modelTier, id, userId);

  return findConversationForUser(id, userId);
}

export function updateConversationModelTierForProfile(
  userId: string,
  profileId: string,
  modelTier: 'advanced' | 'max' | 'regular',
): void {
  getDb()
    .prepare(
      `
        UPDATE conversations
        SET model_tier = ?
        WHERE user_id = ? AND profile_id = ?
      `,
    )
    .run(modelTier, userId, profileId);
}

export function deleteConversationForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function createChatRoom(input: {
  userId: string;
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourceRoomId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  title: string;
  description: string;
  characters: Array<{
    name: string;
    shortDescription?: string;
    fullDescription: string;
  }>;
}): StoredChatRoom {
  const db = getDb();
  const roomId = randomUUID();
  const insertRoom = db.prepare(
    `
      INSERT INTO chat_rooms (
        id,
        user_id,
        profile_id,
        title,
        description,
        source_room_id,
        source_user_id,
        source_profile_id,
        shared_via
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );
  const insertCharacter = db.prepare(
    `
      INSERT INTO chat_room_characters (
        id,
        room_id,
        name,
        short_description,
        full_description,
        position
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  );

  db.transaction(() => {
    insertRoom.run(
      roomId,
      input.userId,
      input.profileId,
      input.title,
      input.description,
      input.sourceRoomId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

    input.characters.forEach((character, index) => {
      insertCharacter.run(
        randomUUID(),
        roomId,
        character.name,
        character.shortDescription ?? '',
        character.fullDescription,
        index,
      );
    });
  })();

  const room = findChatRoomForUser(roomId, input.userId);
  if (!room) {
    throw new Error('Could not load newly created chat room.');
  }

  return room;
}

export function findChatRoomForUser(
  id: string,
  userId: string,
): StoredChatRoom | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          profile_id,
          title,
          description,
          source_room_id,
          source_user_id,
          source_profile_id,
          shared_via,
          created_at,
          updated_at
        FROM chat_rooms
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ChatRoomRow | undefined;

  return row ? toStoredChatRoom(row) : null;
}

export function findChatRoomById(id: string): StoredChatRoom | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          profile_id,
          title,
          description,
          source_room_id,
          source_user_id,
          source_profile_id,
          shared_via,
          created_at,
          updated_at
        FROM chat_rooms
        WHERE id = ?
      `,
    )
    .get(id) as ChatRoomRow | undefined;

  return row ? toStoredChatRoom(row) : null;
}

export function listChatRoomsForProfile(
  userId: string,
  profileId: string,
): StoredChatRoom[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          profile_id,
          title,
          description,
          source_room_id,
          source_user_id,
          source_profile_id,
          shared_via,
          created_at,
          updated_at
        FROM chat_rooms
        WHERE user_id = ? AND profile_id = ?
        ORDER BY
          CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END ASC,
          updated_at DESC,
          created_at DESC
      `,
    )
    .all(userId, profileId) as ChatRoomRow[];

  return rows.map(toStoredChatRoom);
}

export function deleteChatRoomForUser(roomId: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM chat_rooms WHERE id = ? AND user_id = ?')
    .run(roomId, userId);

  return result.changes > 0;
}

export function updateChatRoomForUser(input: {
  roomId: string;
  userId: string;
  title: string;
  description: string;
  characters: Array<{
    name: string;
    shortDescription?: string;
    fullDescription: string;
  }>;
}): StoredChatRoom | null {
  const db = getDb();
  const room = findChatRoomForUser(input.roomId, input.userId);
  if (!room) {
    return null;
  }

  const updateRoom = db.prepare(
    `
      UPDATE chat_rooms
      SET title = ?,
          description = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
  );
  const deleteCharacters = db.prepare(
    'DELETE FROM chat_room_characters WHERE room_id = ?',
  );
  const insertCharacter = db.prepare(
    `
      INSERT INTO chat_room_characters (
        id,
        room_id,
        name,
        short_description,
        full_description,
        position
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  );

  db.transaction(() => {
    updateRoom.run(input.title, input.description, input.roomId, input.userId);
    deleteCharacters.run(input.roomId);

    input.characters.forEach((character, index) => {
      insertCharacter.run(
        randomUUID(),
        input.roomId,
        character.name,
        character.shortDescription ?? '',
        character.fullDescription,
        index,
      );
    });
  })();

  return findChatRoomForUser(input.roomId, input.userId);
}

export function archiveChatRoomForUser(
  roomId: string,
  userId: string,
): StoredChatRoom | null {
  const room = findChatRoomForUser(roomId, userId);
  if (!room) {
    return null;
  }

  getDb()
    .prepare(
      `
        UPDATE chat_rooms
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(roomId, userId);

  return findChatRoomForUser(roomId, userId);
}

export function restoreChatRoomForUser(
  roomId: string,
  userId: string,
): StoredChatRoom | null {
  const room = findChatRoomForUser(roomId, userId);
  if (!room) {
    return null;
  }

  getDb()
    .prepare(
      `
        UPDATE chat_rooms
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(roomId, userId);

  return findChatRoomForUser(roomId, userId);
}

export function findImportedChatRoomForProfile(input: {
  profileId: string;
  sourceRoomId: string;
  userId: string;
}): StoredChatRoom | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          profile_id,
          title,
          description,
          source_room_id,
          source_user_id,
          source_profile_id,
          shared_via,
          created_at,
          updated_at
        FROM chat_rooms
        WHERE user_id = ?
          AND profile_id = ?
          AND source_room_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourceRoomId) as ChatRoomRow | undefined;

  return row ? toStoredChatRoom(row) : null;
}

export function importChatRoomToProfile(input: {
  shareKind: 'profile' | 'link';
  sourceRoom: StoredChatRoom;
  targetProfileId: string;
  userId: string;
}): StoredChatRoom {
  const existing = findImportedChatRoomForProfile({
    profileId: input.targetProfileId,
    sourceRoomId: input.sourceRoom.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  const characters = listChatRoomCharacters(input.sourceRoom.id).map((character) => ({
    fullDescription: character.fullDescription,
    name: character.name,
    shortDescription: character.shortDescription,
  }));

  return createChatRoom({
    characters,
    description: input.sourceRoom.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourceProfileId: input.sourceRoom.profileId,
    sourceRoomId: input.sourceRoom.id,
    sourceUserId: input.sourceRoom.userId,
    title: input.sourceRoom.title,
    userId: input.userId,
  });
}

export function listChatRoomCharacters(
  roomId: string,
): StoredChatRoomCharacter[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, room_id, name, short_description, full_description, position, created_at, updated_at
        FROM chat_room_characters
        WHERE room_id = ?
        ORDER BY position ASC, created_at ASC
      `,
    )
    .all(roomId) as ChatRoomCharacterRow[];

  return rows.map(toStoredChatRoomCharacter);
}

export function findChatRoomShareLinkById(
  id: string,
): StoredChatRoomShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, room_id, created_at, revoked_at
        FROM chat_room_share_links
        WHERE id = ?
      `,
    )
    .get(id) as ChatRoomShareLinkRow | undefined;

  return row ? toStoredChatRoomShareLink(row) : null;
}

export function findChatRoomShareLinkForRoom(
  roomId: string,
): StoredChatRoomShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, room_id, created_at, revoked_at
        FROM chat_room_share_links
        WHERE room_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(roomId) as ChatRoomShareLinkRow | undefined;

  return row ? toStoredChatRoomShareLink(row) : null;
}

export function getOrCreateChatRoomShareLink(
  roomId: string,
): StoredChatRoomShareLink {
  const existing = findChatRoomShareLinkForRoom(roomId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO chat_room_share_links (id, room_id)
        VALUES (?, ?)
        ON CONFLICT(room_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, roomId);

  const created = findChatRoomShareLinkForRoom(roomId);
  if (!created) {
    throw new Error('Could not load newly created chat room share link.');
  }

  return created;
}

export function createChatRoomConversation(
  userId: string,
  room: StoredChatRoom,
  title = room.title,
): StoredChatRoomConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO chat_room_conversations (id, room_id, user_id, profile_id, title)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(id, room.id, userId, room.profileId, title);

  const conversation = findChatRoomConversationForUser(id, userId);
  if (!conversation) {
    throw new Error('Could not load newly created chat room conversation.');
  }

  return conversation;
}

export function findChatRoomConversationForUser(
  id: string,
  userId: string,
): StoredChatRoomConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          c.id,
          c.room_id,
          c.user_id,
          c.profile_id,
          c.title,
          c.created_at,
          c.updated_at,
          r.id AS report_id,
          r.created_at AS report_created_at,
          r.practice_guide_id AS report_practice_guide_id
        FROM chat_room_conversations c
        LEFT JOIN chat_room_conversation_reports r
          ON r.conversation_id = c.id
        WHERE c.id = ? AND c.user_id = ?
      `,
    )
    .get(id, userId) as ChatRoomConversationRow | undefined;

  return row ? toStoredChatRoomConversation(row) : null;
}

export function listChatRoomConversationsForRoom(
  roomId: string,
  userId: string,
): StoredChatRoomConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          c.id,
          c.room_id,
          c.user_id,
          c.profile_id,
          c.title,
          c.created_at,
          c.updated_at,
          r.id AS report_id,
          r.created_at AS report_created_at,
          r.practice_guide_id AS report_practice_guide_id
        FROM chat_room_conversations c
        LEFT JOIN chat_room_conversation_reports r
          ON r.conversation_id = c.id
        WHERE c.room_id = ? AND c.user_id = ?
        ORDER BY c.updated_at DESC, c.created_at DESC
      `,
    )
    .all(roomId, userId) as ChatRoomConversationRow[];

  return rows.map(toStoredChatRoomConversation);
}

export function findLatestChatRoomConversationForRoom(
  roomId: string,
  userId: string,
): StoredChatRoomConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          c.id,
          c.room_id,
          c.user_id,
          c.profile_id,
          c.title,
          c.created_at,
          c.updated_at,
          r.id AS report_id,
          r.created_at AS report_created_at,
          r.practice_guide_id AS report_practice_guide_id
        FROM chat_room_conversations c
        LEFT JOIN chat_room_conversation_reports r
          ON r.conversation_id = c.id
        WHERE c.room_id = ? AND c.user_id = ?
        ORDER BY c.updated_at DESC, c.created_at DESC
        LIMIT 1
      `,
    )
    .get(roomId, userId) as ChatRoomConversationRow | undefined;

  return row ? toStoredChatRoomConversation(row) : null;
}

export function touchChatRoomConversation(conversationId: string): void {
  getDb()
    .prepare(
      'UPDATE chat_room_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
    .run(conversationId);
}

export function findChatRoomConversationReport(
  conversationId: string,
  userId: string,
): StoredChatRoomConversationReport | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          room_id,
          user_id,
          profile_id,
          summary_title,
          summary_description,
          slides_json,
          practice_guide_id,
          created_at,
          updated_at
        FROM chat_room_conversation_reports
        WHERE conversation_id = ? AND user_id = ?
      `,
    )
    .get(conversationId, userId) as ChatRoomConversationReportRow | undefined;

  return row ? toStoredChatRoomConversationReport(row) : null;
}

export function saveChatRoomConversationReport(input: {
  conversationId: string;
  profileId: string;
  roomId: string;
  slides: StoredChatRoomConversationReportSlide[];
  summaryDescription: string;
  summaryTitle: string;
  userId: string;
}): StoredChatRoomConversationReport {
  const existing = findChatRoomConversationReport(input.conversationId, input.userId);

  if (existing) {
    getDb()
      .prepare(
        `
          UPDATE chat_room_conversation_reports
          SET summary_title = ?,
              summary_description = ?,
              slides_json = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
      )
      .run(
        input.summaryTitle,
        input.summaryDescription,
        JSON.stringify(input.slides),
        existing.id,
      );

    const updated = findChatRoomConversationReport(input.conversationId, input.userId);
    if (!updated) {
      throw new Error('Could not load updated chat room conversation report.');
    }

    touchChatRoomConversation(input.conversationId);

    return updated;
  }

  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO chat_room_conversation_reports (
          id,
          conversation_id,
          room_id,
          user_id,
          profile_id,
          summary_title,
          summary_description,
          slides_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.conversationId,
      input.roomId,
      input.userId,
      input.profileId,
      input.summaryTitle,
      input.summaryDescription,
      JSON.stringify(input.slides),
    );

  const created = findChatRoomConversationReport(input.conversationId, input.userId);
  if (!created) {
    throw new Error('Could not load newly created chat room conversation report.');
  }

  touchChatRoomConversation(input.conversationId);

  return created;
}

export function setChatRoomConversationReportPracticeGuide(input: {
  conversationId: string;
  practiceGuideId: string | null;
  userId: string;
}): StoredChatRoomConversationReport | null {
  getDb()
    .prepare(
      `
        UPDATE chat_room_conversation_reports
        SET practice_guide_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `,
    )
    .run(input.practiceGuideId, input.conversationId, input.userId);

  touchChatRoomConversation(input.conversationId);

  return findChatRoomConversationReport(input.conversationId, input.userId);
}

export function findTutorConversationReport(
  conversationId: string,
  userId: string,
): StoredTutorConversationReport | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          user_id,
          profile_id,
          summary_title,
          summary_description,
          report_json,
          practice_guide_id,
          created_at,
          updated_at
        FROM tutor_conversation_reports
        WHERE conversation_id = ? AND user_id = ?
      `,
    )
    .get(conversationId, userId) as TutorConversationReportRow | undefined;

  return row ? toStoredTutorConversationReport(row) : null;
}

export function saveTutorConversationReport(input: {
  conversationId: string;
  profileId: string;
  report: StoredTutorConversationReportData;
  summaryDescription: string;
  summaryTitle: string;
  userId: string;
}): StoredTutorConversationReport {
  const existing = findTutorConversationReport(input.conversationId, input.userId);

  if (existing) {
    getDb()
      .prepare(
        `
          UPDATE tutor_conversation_reports
          SET summary_title = ?,
              summary_description = ?,
              report_json = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
      )
      .run(
        input.summaryTitle,
        input.summaryDescription,
        JSON.stringify(input.report),
        existing.id,
      );

    const updated = findTutorConversationReport(input.conversationId, input.userId);
    if (!updated) {
      throw new Error('Could not load updated tutor conversation report.');
    }

    touchConversation(input.conversationId);
    return updated;
  }

  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO tutor_conversation_reports (
          id,
          conversation_id,
          user_id,
          profile_id,
          summary_title,
          summary_description,
          report_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.conversationId,
      input.userId,
      input.profileId,
      input.summaryTitle,
      input.summaryDescription,
      JSON.stringify(input.report),
    );

  const created = findTutorConversationReport(input.conversationId, input.userId);
  if (!created) {
    throw new Error('Could not load newly created tutor conversation report.');
  }

  touchConversation(input.conversationId);
  return created;
}

export function setTutorConversationReportPracticeGuide(input: {
  conversationId: string;
  practiceGuideId: string | null;
  userId: string;
}): StoredTutorConversationReport | null {
  getDb()
    .prepare(
      `
        UPDATE tutor_conversation_reports
        SET practice_guide_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `,
    )
    .run(input.practiceGuideId, input.conversationId, input.userId);

  touchConversation(input.conversationId);

  return findTutorConversationReport(input.conversationId, input.userId);
}

export function findLearnerProgressProfile(
  userId: string,
  profileId: string,
): StoredLearnerProgressProfile | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          profile_id,
          summary_json,
          created_at,
          updated_at
        FROM learner_progress_profiles
        WHERE user_id = ? AND profile_id = ?
      `,
    )
    .get(userId, profileId) as LearnerProgressProfileRow | undefined;

  return row ? toStoredLearnerProgressProfile(row) : null;
}

export function upsertLearnerProgressProfile(input: {
  profileId: string;
  summary: StoredLearnerProgressSummary;
  userId: string;
}): StoredLearnerProgressProfile {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO learner_progress_profiles (
          id,
          user_id,
          profile_id,
          summary_json
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, profile_id) DO UPDATE SET
          summary_json = excluded.summary_json,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(id, input.userId, input.profileId, JSON.stringify(input.summary));

  const profile = findLearnerProgressProfile(input.userId, input.profileId);
  if (!profile) {
    throw new Error('Could not load learner progress profile.');
  }

  return profile;
}

export function listLearnerProgressEvents(input: {
  limit?: number;
  profileId: string;
  userId: string;
}): StoredLearnerProgressEvent[] {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const rows = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          profile_id,
          source_type,
          source_id,
          event_date,
          title,
          summary,
          details_json,
          created_at,
          updated_at
        FROM learner_progress_events
        WHERE user_id = ? AND profile_id = ?
        ORDER BY event_date DESC, id DESC
        LIMIT ?
      `,
    )
    .all(input.userId, input.profileId, limit) as LearnerProgressEventRow[];

  return rows.map(toStoredLearnerProgressEvent);
}

export function upsertLearnerProgressEvent(input: {
  details: StoredLearnerProgressEventDetails;
  eventDate?: string;
  profileId: string;
  sourceId: string;
  sourceType: LearnerProgressSourceType;
  summary: string;
  title: string;
  userId: string;
}): StoredLearnerProgressEvent {
  getDb()
    .prepare(
      `
        INSERT INTO learner_progress_events (
          user_id,
          profile_id,
          source_type,
          source_id,
          event_date,
          title,
          summary,
          details_json
        )
        VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?)
        ON CONFLICT(user_id, profile_id, source_type, source_id) DO UPDATE SET
          event_date = excluded.event_date,
          title = excluded.title,
          summary = excluded.summary,
          details_json = excluded.details_json,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(
      input.userId,
      input.profileId,
      input.sourceType,
      input.sourceId,
      input.eventDate ?? null,
      input.title,
      input.summary,
      JSON.stringify(input.details),
    );

  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          profile_id,
          source_type,
          source_id,
          event_date,
          title,
          summary,
          details_json,
          created_at,
          updated_at
        FROM learner_progress_events
        WHERE user_id = ?
          AND profile_id = ?
          AND source_type = ?
          AND source_id = ?
      `,
    )
    .get(
      input.userId,
      input.profileId,
      input.sourceType,
      input.sourceId,
    ) as LearnerProgressEventRow | undefined;

  if (!row) {
    throw new Error('Could not load learner progress event.');
  }

  return toStoredLearnerProgressEvent(row);
}

export function createQuiz(input: {
  authoringMessages?: QuizAuthoringMessage[];
  description?: string;
  instructions?: string;
  level?: string;
  profileId: string;
  quiz: Record<string, unknown>;
  sharedVia?: 'link' | 'profile' | null;
  sourceQuizId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  targetTopic?: string;
  title: string;
  userId: string;
}): StoredQuiz {
  const id = randomUUID();
  const db = getDb();
  const transaction = db.transaction(() => {
    insertResource(db, {
      description: input.description ?? '',
      id,
      level: input.level ?? '',
      profileId: input.profileId,
      sharedVia: input.sharedVia ?? null,
      sourceProfileId: input.sourceProfileId ?? null,
      sourceResourceId: input.sourceQuizId ?? null,
      sourceUserId: input.sourceUserId ?? null,
      title: input.title,
      topic: input.targetTopic ?? '',
      type: 'quiz',
      userId: input.userId,
    });
    db.prepare(
      `
        INSERT INTO quizzes (
          id,
          user_id,
          profile_id,
          title,
          description,
          target_topic,
          level,
          instructions,
          quiz_json,
          authoring_messages_json,
          source_quiz_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .run(
        id,
        input.userId,
        input.profileId,
        input.title,
        input.description ?? '',
        input.targetTopic ?? '',
        input.level ?? '',
        input.instructions ?? '',
        JSON.stringify(input.quiz),
        JSON.stringify(input.authoringMessages ?? []),
        input.sourceQuizId ?? null,
        input.sourceUserId ?? null,
        input.sourceProfileId ?? null,
        input.sharedVia ?? null,
      );
  });

  transaction();

  const quiz = findQuizForUser(id, input.userId);
  if (!quiz) {
    throw new Error('Could not load newly created quiz.');
  }

  return quiz;
}

export function findQuizForUser(
  id: string,
  userId: string,
): StoredQuiz | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          allow_public_attempts,
          archived_at,
          authoring_messages_json,
          created_at,
          description,
          id,
          instructions,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_quiz_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM quizzes
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as QuizRow | undefined;

  return row ? toStoredQuiz(row) : null;
}

export function findQuizById(id: string): StoredQuiz | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          allow_public_attempts,
          archived_at,
          authoring_messages_json,
          created_at,
          description,
          id,
          instructions,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_quiz_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM quizzes
        WHERE id = ?
      `,
    )
    .get(id) as QuizRow | undefined;

  return row ? toStoredQuiz(row) : null;
}

export function listQuizzesForProfile(input: {
  includeArchived?: boolean;
  profileId: string;
  userId: string;
}): StoredQuiz[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          allow_public_attempts,
          archived_at,
          authoring_messages_json,
          created_at,
          description,
          id,
          instructions,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_quiz_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM quizzes
        WHERE user_id = ?
          AND profile_id = ?
          AND (? = 1 OR archived_at IS NULL)
        ORDER BY
          CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END ASC,
          updated_at DESC,
          created_at DESC
      `,
    )
    .all(input.userId, input.profileId, input.includeArchived ? 1 : 0) as QuizRow[];

  return rows.map(toStoredQuiz);
}

export function updateQuiz(input: {
  quizId: string;
  authoringMessages?: QuizAuthoringMessage[];
  description: string;
  instructions: string;
  level: string;
  quiz: Record<string, unknown>;
  targetTopic: string;
  title: string;
  userId: string;
}): StoredQuiz | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    updateResourceMetadata(db, {
      description: input.description,
      id: input.quizId,
      level: input.level,
      title: input.title,
      topic: input.targetTopic,
      userId: input.userId,
    });
    db.prepare(
      `
        UPDATE quizzes
        SET title = ?,
            description = ?,
            target_topic = ?,
            level = ?,
            instructions = ?,
            quiz_json = ?,
            authoring_messages_json = COALESCE(?, authoring_messages_json),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
      .run(
        input.title,
        input.description,
        input.targetTopic,
        input.level,
        input.instructions,
        JSON.stringify(input.quiz),
        input.authoringMessages === undefined
          ? null
          : JSON.stringify(input.authoringMessages),
        input.quizId,
        input.userId,
      );
  });

  transaction();

  return findQuizForUser(input.quizId, input.userId);
}

export function setQuizPublicAttempts(input: {
  allowPublicAttempts: boolean;
  quizId: string;
  userId: string;
}): StoredQuiz | null {
  getDb()
    .prepare(
      `
        UPDATE quizzes
        SET allow_public_attempts = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(input.allowPublicAttempts ? 1 : 0, input.quizId, input.userId);

  return findQuizForUser(input.quizId, input.userId);
}

export function updateQuizAuthoringMessages(input: {
  quizId: string;
  messages: QuizAuthoringMessage[];
  userId: string;
}): StoredQuiz | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(input.quizId, input.userId);
    db.prepare(
      `
        UPDATE quizzes
        SET authoring_messages_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
      .run(
        JSON.stringify(input.messages),
        input.quizId,
        input.userId,
      );
  });

  transaction();

  return findQuizForUser(input.quizId, input.userId);
}

export function findImportedQuizForProfile(input: {
  profileId: string;
  sourceQuizId: string;
  userId: string;
}): StoredQuiz | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          allow_public_attempts,
          archived_at,
          authoring_messages_json,
          created_at,
          description,
          id,
          instructions,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_quiz_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM quizzes
        WHERE user_id = ?
          AND profile_id = ?
          AND source_quiz_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourceQuizId) as
    | QuizRow
    | undefined;

  return row ? toStoredQuiz(row) : null;
}

export function importQuizToProfile(input: {
  shareKind: 'profile' | 'link';
  sourceQuiz: StoredQuiz;
  targetProfileId: string;
  userId: string;
}): StoredQuiz {
  const existing = findImportedQuizForProfile({
    profileId: input.targetProfileId,
    sourceQuizId: input.sourceQuiz.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  return createQuiz({
    description: input.sourceQuiz.description,
    instructions: input.sourceQuiz.instructions,
    level: input.sourceQuiz.level,
    profileId: input.targetProfileId,
    quiz: input.sourceQuiz.quiz,
    sharedVia: input.shareKind,
    sourceQuizId: input.sourceQuiz.id,
    sourceProfileId: input.sourceQuiz.profileId,
    sourceUserId: input.sourceQuiz.userId,
    targetTopic: input.sourceQuiz.targetTopic,
    title: input.sourceQuiz.title,
    userId: input.userId,
  });
}

export function archiveQuizForUser(
  quizId: string,
  userId: string,
): StoredQuiz | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    archiveResource(db, quizId, userId);
    db.prepare(
      `
        UPDATE quizzes
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
      .run(quizId, userId);
  });

  transaction();

  return findQuizForUser(quizId, userId);
}

export function restoreQuizForUser(
  quizId: string,
  userId: string,
): StoredQuiz | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    restoreResource(db, quizId, userId);
    db.prepare(
      `
        UPDATE quizzes
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
      .run(quizId, userId);
  });

  transaction();

  return findQuizForUser(quizId, userId);
}

export function findQuizShareLinkById(
  id: string,
): StoredQuizShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, quiz_id, created_at, revoked_at
        FROM quiz_share_links
        WHERE id = ?
      `,
    )
    .get(id) as QuizShareLinkRow | undefined;

  return row ? toStoredQuizShareLink(row) : null;
}

export function findQuizShareLinkForQuiz(
  quizId: string,
): StoredQuizShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, quiz_id, created_at, revoked_at
        FROM quiz_share_links
        WHERE quiz_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(quizId) as QuizShareLinkRow | undefined;

  return row ? toStoredQuizShareLink(row) : null;
}

export function getOrCreateQuizShareLink(
  quizId: string,
): StoredQuizShareLink {
  const existing = findQuizShareLinkForQuiz(quizId);
  if (existing) {
    upsertResourceShareLink(getDb(), existing.id, quizId);
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO quiz_share_links (id, quiz_id)
        VALUES (?, ?)
        ON CONFLICT(quiz_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
      .run(id, quizId);
    upsertResourceShareLink(db, id, quizId);
  });

  transaction();

  const created = findQuizShareLinkForQuiz(quizId);
  if (!created) {
    throw new Error('Could not load newly created quiz share link.');
  }

  return created;
}

export function createQuizAttempt(input: {
  quizId: string;
  profileId?: string | null;
  snapshot: Record<string, unknown>;
  userId?: string | null;
}): StoredQuizAttempt {
  const id = randomUUID();
  const isGuest = !input.userId;
  const guestToken = isGuest ? randomBytes(24).toString('base64url') : null;
  const claimToken = isGuest ? randomBytes(24).toString('base64url') : null;
  getDb()
    .prepare(
      `
        INSERT INTO quiz_attempts (
          id,
          quiz_id,
          user_id,
          profile_id,
          guest_token,
          claim_token,
          snapshot_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.quizId,
      input.userId ?? null,
      input.profileId ?? null,
      guestToken,
      claimToken,
      JSON.stringify(input.snapshot),
    );

  const attempt = findQuizAttemptById(id);
  if (!attempt) {
    throw new Error('Could not load newly created quiz attempt.');
  }

  return attempt;
}

export function findQuizAttemptById(id: string): StoredQuizAttempt | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          quiz_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          profile_id,
          progress_event_id,
          responses_json,
          result_json,
          snapshot_json,
          started_at,
          status,
          submitted_at,
          updated_at,
          user_id
        FROM quiz_attempts
        WHERE id = ?
      `,
    )
    .get(id) as QuizAttemptRow | undefined;

  return row ? toStoredQuizAttempt(row) : null;
}

export function findQuizAttemptForUser(
  id: string,
  userId: string,
): StoredQuizAttempt | null {
  const attempt = findQuizAttemptById(id);
  return attempt?.userId === userId ? attempt : null;
}

export function findQuizAttemptByGuestToken(
  guestToken: string,
): StoredQuizAttempt | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          quiz_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          profile_id,
          progress_event_id,
          responses_json,
          result_json,
          snapshot_json,
          started_at,
          status,
          submitted_at,
          updated_at,
          user_id
        FROM quiz_attempts
        WHERE guest_token = ?
      `,
    )
    .get(guestToken) as QuizAttemptRow | undefined;

  return row ? toStoredQuizAttempt(row) : null;
}

export function findQuizAttemptByClaimToken(
  claimToken: string,
): StoredQuizAttempt | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          quiz_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          profile_id,
          progress_event_id,
          responses_json,
          result_json,
          snapshot_json,
          started_at,
          status,
          submitted_at,
          updated_at,
          user_id
        FROM quiz_attempts
        WHERE claim_token = ?
      `,
    )
    .get(claimToken) as QuizAttemptRow | undefined;

  return row ? toStoredQuizAttempt(row) : null;
}

export function listQuizAttemptsForUser(input: {
  quizId?: string;
  profileId: string;
  userId: string;
}): StoredQuizAttempt[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          quiz_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          profile_id,
          progress_event_id,
          responses_json,
          result_json,
          snapshot_json,
          started_at,
          status,
          submitted_at,
          updated_at,
          user_id
        FROM quiz_attempts
        WHERE user_id = ?
          AND profile_id = ?
          AND (? IS NULL OR quiz_id = ?)
        ORDER BY created_at DESC
      `,
    )
    .all(
      input.userId,
      input.profileId,
      input.quizId ?? null,
      input.quizId ?? null,
    ) as QuizAttemptRow[];

  return rows.map(toStoredQuizAttempt);
}

export function submitQuizAttempt(input: {
  attemptId: string;
  responses: unknown[];
}): StoredQuizAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE quiz_attempts
        SET responses_json = ?,
            status = 'submitted',
            submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('draft', 'failed')
      `,
    )
    .run(JSON.stringify(input.responses), input.attemptId);

  return findQuizAttemptById(input.attemptId);
}

export function markQuizAttemptEvaluating(
  attemptId: string,
): StoredQuizAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE quiz_attempts
        SET status = 'evaluating',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(attemptId);

  return findQuizAttemptById(attemptId);
}

export function saveQuizAttemptResult(input: {
  attemptId: string;
  result: Record<string, unknown>;
}): StoredQuizAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE quiz_attempts
        SET result_json = ?,
            status = 'evaluated',
            evaluated_at = COALESCE(evaluated_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(JSON.stringify(input.result), input.attemptId);

  return findQuizAttemptById(input.attemptId);
}

export function markQuizAttemptFailed(
  attemptId: string,
): StoredQuizAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE quiz_attempts
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(attemptId);

  return findQuizAttemptById(attemptId);
}

export function attachQuizAttemptToUser(input: {
  attemptId: string;
  claimToken: string;
  profileId: string;
  userId: string;
}): StoredQuizAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE quiz_attempts
        SET user_id = ?,
            profile_id = ?,
            claim_token = NULL,
            guest_token = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND claim_token = ?
          AND user_id IS NULL
      `,
    )
    .run(input.userId, input.profileId, input.attemptId, input.claimToken);

  return findQuizAttemptById(input.attemptId);
}

export function setQuizAttemptProgressEvent(input: {
  attemptId: string;
  progressEventId: number;
}): StoredQuizAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE quiz_attempts
        SET progress_event_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(input.progressEventId, input.attemptId);

  return findQuizAttemptById(input.attemptId);
}

export function createConversationFromQuizAttempt(input: {
  attempt: StoredQuizAttempt;
  profileId: string;
  userId: string;
}): StoredConversation {
  const title = readStringFromRecord(input.attempt.snapshot, 'title') || defaultConversationTitle;
  const conversation = createConversation(
    input.userId,
    input.profileId,
    `Practicar: ${title}`,
  );

  createConversationQuizAttemptSnapshot(conversation.id, input.attempt);
  addResourceSourceNoticeMessage(conversation.id, {
    attemptId: input.attempt.id,
    resourceId: input.attempt.quizId,
    resourcePath: `/quizzes/${encodeURIComponent(input.attempt.quizId)}`,
    resultPath: `/quiz-attempts/${encodeURIComponent(input.attempt.id)}/result`,
    title,
    type: 'quiz',
  });
  return conversation;
}

export function createConversationQuizAttemptSnapshot(
  conversationId: string,
  attempt: StoredQuizAttempt,
): StoredConversationQuizAttemptSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_quiz_attempt_snapshots (
          conversation_id,
          quiz_attempt_id,
          quiz_title,
          quiz_description,
          quiz_target_topic,
          quiz_snapshot_json,
          responses_json,
          result_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      attempt.id,
      readStringFromRecord(attempt.snapshot, 'title'),
      readStringFromRecord(attempt.snapshot, 'description'),
      readStringFromRecord(attempt.snapshot, 'targetTopic'),
      JSON.stringify(attempt.snapshot),
      JSON.stringify(attempt.responses),
      JSON.stringify(attempt.result ?? {}),
    );

  const snapshot = getConversationQuizAttemptSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation quiz-attempt snapshot.');
  }

  return snapshot;
}

export function getConversationQuizAttemptSnapshot(
  conversationId: string,
): StoredConversationQuizAttemptSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          quiz_attempt_id,
          quiz_description,
          quiz_snapshot_json,
          quiz_target_topic,
          quiz_title,
          conversation_id,
          created_at,
          responses_json,
          result_json
        FROM conversation_quiz_attempt_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationQuizAttemptSnapshotRow | undefined;

  return row ? toStoredConversationQuizAttemptSnapshot(row) : null;
}

const roleplaySelectColumns = `
  archived_at,
  authoring_messages_json,
  characters_json,
  created_at,
  description,
  id,
  level,
  max_learner_turns,
  pedagogical_focus,
  profile_id,
  scenario,
  shared_via,
  source_profile_id,
  source_roleplay_id,
  source_user_id,
  title,
  updated_at,
  user_id
`;

export function createRoleplay(input: {
  authoringMessages?: RoleplayAuthoringMessage[];
  characters: RoleplayCharacter[];
  description?: string;
  level?: string;
  maxLearnerTurns?: number | null;
  pedagogicalFocus?: string;
  profileId: string;
  scenario?: string;
  sharedVia?: 'link' | 'profile' | null;
  sourceProfileId?: string | null;
  sourceRoleplayId?: string | null;
  sourceUserId?: string | null;
  title: string;
  userId: string;
}): StoredRoleplay {
  const id = randomUUID();
  const db = getDb();
  const transaction = db.transaction(() => {
    insertResource(db, {
      description: input.description ?? '',
      id,
      level: input.level ?? '',
      profileId: input.profileId,
      sharedVia: input.sharedVia ?? null,
      sourceProfileId: input.sourceProfileId ?? null,
      sourceResourceId: input.sourceRoleplayId ?? null,
      sourceUserId: input.sourceUserId ?? null,
      title: input.title,
      topic: '',
      type: 'roleplay',
      userId: input.userId,
    });
    db.prepare(
      `
        INSERT INTO roleplays (
          id,
          user_id,
          profile_id,
          title,
          description,
          scenario,
          level,
          pedagogical_focus,
          max_learner_turns,
          characters_json,
          authoring_messages_json,
          source_roleplay_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      input.userId,
      input.profileId,
      input.title,
      input.description ?? '',
      input.scenario ?? '',
      input.level ?? '',
      input.pedagogicalFocus ?? '',
      input.maxLearnerTurns ?? null,
      JSON.stringify(input.characters),
      JSON.stringify(input.authoringMessages ?? []),
      input.sourceRoleplayId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );
  });

  transaction();

  const roleplay = findRoleplayForUser(id, input.userId);
  if (!roleplay) {
    throw new Error('Could not load newly created roleplay.');
  }

  return roleplay;
}

export function findRoleplayForUser(
  id: string,
  userId: string,
): StoredRoleplay | null {
  const row = getDb()
    .prepare(
      `
        SELECT ${roleplaySelectColumns}
        FROM roleplays
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as RoleplayRow | undefined;

  return row ? toStoredRoleplay(row) : null;
}

export function findRoleplayById(id: string): StoredRoleplay | null {
  const row = getDb()
    .prepare(
      `
        SELECT ${roleplaySelectColumns}
        FROM roleplays
        WHERE id = ?
      `,
    )
    .get(id) as RoleplayRow | undefined;

  return row ? toStoredRoleplay(row) : null;
}

export function updateRoleplay(input: {
  authoringMessages?: RoleplayAuthoringMessage[];
  characters: RoleplayCharacter[];
  description: string;
  level: string;
  maxLearnerTurns: number | null;
  pedagogicalFocus: string;
  roleplayId: string;
  scenario: string;
  title: string;
  userId: string;
}): StoredRoleplay | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    updateResourceMetadata(db, {
      description: input.description,
      id: input.roleplayId,
      level: input.level,
      title: input.title,
      topic: '',
      userId: input.userId,
    });
    db.prepare(
      `
        UPDATE roleplays
        SET title = ?,
            description = ?,
            scenario = ?,
            level = ?,
            pedagogical_focus = ?,
            max_learner_turns = ?,
            characters_json = ?,
            authoring_messages_json = COALESCE(?, authoring_messages_json),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(
      input.title,
      input.description,
      input.scenario,
      input.level,
      input.pedagogicalFocus,
      input.maxLearnerTurns,
      JSON.stringify(input.characters),
      input.authoringMessages === undefined
        ? null
        : JSON.stringify(input.authoringMessages),
      input.roleplayId,
      input.userId,
    );
  });

  transaction();
  return findRoleplayForUser(input.roleplayId, input.userId);
}

export function updateRoleplayAuthoringMessages(input: {
  messages: RoleplayAuthoringMessage[];
  roleplayId: string;
  userId: string;
}): StoredRoleplay | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(input.roleplayId, input.userId);
    db.prepare(
      `
        UPDATE roleplays
        SET authoring_messages_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(
      JSON.stringify(input.messages),
      input.roleplayId,
      input.userId,
    );
  });

  transaction();
  return findRoleplayForUser(input.roleplayId, input.userId);
}

export function archiveRoleplayForUser(
  roleplayId: string,
  userId: string,
): StoredRoleplay | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    archiveResource(db, roleplayId, userId);
    db.prepare(
      `
        UPDATE roleplays
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(roleplayId, userId);
  });

  transaction();
  return findRoleplayForUser(roleplayId, userId);
}

export function restoreRoleplayForUser(
  roleplayId: string,
  userId: string,
): StoredRoleplay | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    restoreResource(db, roleplayId, userId);
    db.prepare(
      `
        UPDATE roleplays
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(roleplayId, userId);
  });

  transaction();
  return findRoleplayForUser(roleplayId, userId);
}

export function createRoleplayAttempt(input: {
  profileId?: string | null;
  roleplayId: string;
  snapshot: Record<string, unknown>;
  turns: RoleplayTurn[];
  userId?: string | null;
}): StoredRoleplayAttempt {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO roleplay_attempts (
          id,
          roleplay_id,
          user_id,
          profile_id,
          status,
          snapshot_json,
          turns_json
        )
        VALUES (?, ?, ?, ?, 'in_progress', ?, ?)
      `,
    ).run(
      id,
      input.roleplayId,
      input.userId ?? null,
      input.profileId ?? null,
      JSON.stringify(input.snapshot),
      JSON.stringify(input.turns),
    );

  const attempt = findRoleplayAttemptById(id);
  if (!attempt) {
    throw new Error('Could not load newly created roleplay attempt.');
  }

  return attempt;
}

export function findRoleplayAttemptById(id: string): StoredRoleplayAttempt | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          created_at,
          evaluated_at,
          id,
          profile_id,
          progress_event_id,
          result_json,
          roleplay_id,
          snapshot_json,
          started_at,
          status,
          submitted_at,
          turns_json,
          updated_at,
          user_id
        FROM roleplay_attempts
        WHERE id = ?
      `,
    )
    .get(id) as RoleplayAttemptRow | undefined;

  return row ? toStoredRoleplayAttempt(row) : null;
}

export function listRoleplayAttemptsForUser(input: {
  profileId: string;
  roleplayId?: string;
  userId: string;
}): StoredRoleplayAttempt[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          created_at,
          evaluated_at,
          id,
          profile_id,
          progress_event_id,
          result_json,
          roleplay_id,
          snapshot_json,
          started_at,
          status,
          submitted_at,
          turns_json,
          updated_at,
          user_id
        FROM roleplay_attempts
        WHERE user_id = ?
          AND profile_id = ?
          AND (? IS NULL OR roleplay_id = ?)
        ORDER BY created_at DESC
      `,
    )
    .all(
      input.userId,
      input.profileId,
      input.roleplayId ?? null,
      input.roleplayId ?? null,
    ) as RoleplayAttemptRow[];

  return rows.map(toStoredRoleplayAttempt);
}

export function appendRoleplayAttemptTurns(input: {
  attemptId: string;
  turns: RoleplayTurn[];
}): StoredRoleplayAttempt | null {
  const attempt = findRoleplayAttemptById(input.attemptId);
  if (!attempt || attempt.status !== 'in_progress') {
    return attempt;
  }

  getDb()
    .prepare(
      `
        UPDATE roleplay_attempts
        SET turns_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(
      JSON.stringify([...attempt.turns, ...input.turns]),
      input.attemptId,
    );

  return findRoleplayAttemptById(input.attemptId);
}

export function submitRoleplayAttempt(attemptId: string): StoredRoleplayAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE roleplay_attempts
        SET status = 'evaluating',
            submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('in_progress', 'failed')
      `,
    ).run(attemptId);

  return findRoleplayAttemptById(attemptId);
}

export function saveRoleplayAttemptResult(input: {
  attemptId: string;
  result: Record<string, unknown>;
}): StoredRoleplayAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE roleplay_attempts
        SET result_json = ?,
            status = 'evaluated',
            evaluated_at = COALESCE(evaluated_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(JSON.stringify(input.result), input.attemptId);

  return findRoleplayAttemptById(input.attemptId);
}

export function markRoleplayAttemptFailed(
  attemptId: string,
): StoredRoleplayAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE roleplay_attempts
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(attemptId);

  return findRoleplayAttemptById(attemptId);
}

export function setRoleplayAttemptProgressEvent(input: {
  attemptId: string;
  progressEventId: number;
}): StoredRoleplayAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE roleplay_attempts
        SET progress_event_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(input.progressEventId, input.attemptId);

  return findRoleplayAttemptById(input.attemptId);
}

export function createConversationFromRoleplayAttempt(input: {
  attempt: StoredRoleplayAttempt;
  profileId: string;
  userId: string;
}): StoredConversation {
  const title = readStringFromRecord(input.attempt.snapshot, 'title') || defaultConversationTitle;
  const conversation = createConversation(
    input.userId,
    input.profileId,
    `Practicar: ${title}`,
  );

  createConversationRoleplayAttemptSnapshot(conversation.id, input.attempt);
  addResourceSourceNoticeMessage(conversation.id, {
    attemptId: input.attempt.id,
    resourceId: input.attempt.roleplayId,
    resourcePath: `/roleplays/${encodeURIComponent(input.attempt.roleplayId)}`,
    resultPath: `/roleplay-attempts/${encodeURIComponent(input.attempt.id)}/result`,
    title,
    type: 'roleplay',
  });
  return conversation;
}

export function createConversationRoleplayAttemptSnapshot(
  conversationId: string,
  attempt: StoredRoleplayAttempt,
): StoredConversationRoleplayAttemptSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_roleplay_attempt_snapshots (
          conversation_id,
          roleplay_attempt_id,
          roleplay_title,
          roleplay_description,
          roleplay_snapshot_json,
          turns_json,
          result_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      conversationId,
      attempt.id,
      readStringFromRecord(attempt.snapshot, 'title'),
      readStringFromRecord(attempt.snapshot, 'description'),
      JSON.stringify(attempt.snapshot),
      JSON.stringify(attempt.turns),
      JSON.stringify(attempt.result ?? {}),
    );

  const snapshot = getConversationRoleplayAttemptSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation roleplay-attempt snapshot.');
  }

  return snapshot;
}

export function getConversationRoleplayAttemptSnapshot(
  conversationId: string,
): StoredConversationRoleplayAttemptSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          conversation_id,
          created_at,
          result_json,
          roleplay_attempt_id,
          roleplay_description,
          roleplay_snapshot_json,
          roleplay_title,
          turns_json
        FROM conversation_roleplay_attempt_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationRoleplayAttemptSnapshotRow | undefined;

  return row ? toStoredConversationRoleplayAttemptSnapshot(row) : null;
}

function readStringFromRecord(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function addResourceSourceNoticeMessage(
  conversationId: string,
  input: {
    attemptId: string;
    resourceId: string;
    resourcePath: string;
    resultPath: string;
    title: string;
    type: 'quiz' | 'roleplay';
  },
): void {
  const resourceLabel = input.type === 'quiz' ? 'el quiz' : 'el Roleplay';
  const fallbackTitle = input.type === 'quiz' ? 'este quiz' : 'este Roleplay';
  const title = escapeMarkdownLinkText(input.title || fallbackTitle);
  addMessage(
    conversationId,
    'model',
    [
      `Esta conversación se deriva de ${resourceLabel} [${title}](${input.resourcePath}) y de su [resultado](${input.resultPath}).`,
      'Vamos a practicar a partir de las dificultades encontradas.',
    ].join('\n\n'),
    {
      resourceSourceNotice: {
        attemptId: input.attemptId,
        resourceId: input.resourceId,
        type: input.type,
      },
    },
  );
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/([\\\[\]])/g, '\\$1');
}

export function createPracticeGuide(input: {
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourcePracticeGuideId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
}): StoredPracticeGuide {
  const id = randomUUID();
  const db = getDb();
  const transaction = db.transaction(() => {
    insertResource(db, {
      description: input.description,
      id,
      profileId: input.profileId,
      sharedVia: input.sharedVia ?? null,
      sourceProfileId: input.sourceProfileId ?? null,
      sourceResourceId: input.sourcePracticeGuideId ?? null,
      sourceUserId: input.sourceUserId ?? null,
      title: input.title,
      type: 'practice_guide',
      userId: input.userId,
    });
    db.prepare(
      `
        INSERT INTO practice_guides (
          id,
          user_id,
          profile_id,
          title,
          description,
          tutor_instructions,
          source_practice_guide_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .run(
        id,
        input.userId,
        input.profileId,
        input.title,
        input.description,
        input.tutorInstructions,
        input.sourcePracticeGuideId ?? null,
        input.sourceUserId ?? null,
        input.sourceProfileId ?? null,
        input.sharedVia ?? null,
      );
  });

  transaction();

  const practiceGuide = findPracticeGuideForUser(id, input.userId);
  if (!practiceGuide) {
    throw new Error('Could not load newly created practice guide.');
  }

  return practiceGuide;
}

export function findPracticeGuideForUser(
  id: string,
  userId: string,
): StoredPracticeGuide | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_guide_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_guides
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as PracticeGuideRow | undefined;

  return row ? toStoredPracticeGuide(row) : null;
}

export function findPracticeGuideById(id: string): StoredPracticeGuide | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_guide_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_guides
        WHERE id = ?
      `,
    )
    .get(id) as PracticeGuideRow | undefined;

  return row ? toStoredPracticeGuide(row) : null;
}

export function listPracticeGuidesForProfile(
  userId: string,
  profileId: string,
): StoredPracticeGuide[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_guide_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_guides
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as PracticeGuideRow[];

  return rows.map(toStoredPracticeGuide);
}

export function deletePracticeGuideForUser(id: string, userId: string): boolean {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM resource_folder_items WHERE resource_id = ?').run(id);
    db.prepare('DELETE FROM resources WHERE id = ? AND user_id = ?').run(id, userId);
    return db.prepare('DELETE FROM practice_guides WHERE id = ? AND user_id = ?').run(id, userId);
  });

  const result = transaction();

  return result.changes > 0;
}

export function archivePracticeGuideForUser(
  practiceGuideId: string,
  userId: string,
): StoredPracticeGuide | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    archiveResource(db, practiceGuideId, userId);
    return db.prepare(
      `
        UPDATE practice_guides
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
      .run(practiceGuideId, userId);
  });

  const result = transaction();

  if (result.changes < 1) {
    return null;
  }

  return findPracticeGuideForUser(practiceGuideId, userId);
}

export function restorePracticeGuideForUser(
  practiceGuideId: string,
  userId: string,
): StoredPracticeGuide | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    restoreResource(db, practiceGuideId, userId);
    return db.prepare(
      `
        UPDATE practice_guides
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
      .run(practiceGuideId, userId);
  });

  const result = transaction();

  if (result.changes < 1) {
    return null;
  }

  return findPracticeGuideForUser(practiceGuideId, userId);
}

export function listConversationsForPracticeGuide(
  practiceGuideId: string,
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_guide_id, profile_id, active_agent, model_tier, chat_room_conversation_report_id
        FROM conversations
        WHERE user_id = ? AND profile_id = ? AND practice_guide_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId, practiceGuideId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function updatePracticeGuide(input: {
  practiceGuideId: string;
  description: string;
  title: string;
  tutorInstructions: string;
  userId: string;
}): StoredPracticeGuide | null {
  const db = getDb();
  const transaction = db.transaction(() => {
    updateResourceMetadata(db, {
      description: input.description,
      id: input.practiceGuideId,
      title: input.title,
      userId: input.userId,
    });
    db.prepare(
      `
        UPDATE practice_guides
        SET title = ?,
            description = ?,
            tutor_instructions = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
      .run(
        input.title,
        input.description,
        input.tutorInstructions,
        input.practiceGuideId,
        input.userId,
      );
  });

  transaction();

  return findPracticeGuideForUser(input.practiceGuideId, input.userId);
}

export function findImportedPracticeGuideForProfile(input: {
  profileId: string;
  sourcePracticeGuideId: string;
  userId: string;
}): StoredPracticeGuide | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_guide_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_guides
        WHERE user_id = ?
          AND profile_id = ?
          AND source_practice_guide_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourcePracticeGuideId) as
    | PracticeGuideRow
    | undefined;

  return row ? toStoredPracticeGuide(row) : null;
}

export function importPracticeGuideToProfile(input: {
  shareKind: 'profile' | 'link';
  sourcePracticeGuide: StoredPracticeGuide;
  targetProfileId: string;
  userId: string;
}): StoredPracticeGuide {
  const existing = findImportedPracticeGuideForProfile({
    profileId: input.targetProfileId,
    sourcePracticeGuideId: input.sourcePracticeGuide.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  return createPracticeGuide({
    description: input.sourcePracticeGuide.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourcePracticeGuideId: input.sourcePracticeGuide.id,
    sourceProfileId: input.sourcePracticeGuide.profileId,
    sourceUserId: input.sourcePracticeGuide.userId,
    title: input.sourcePracticeGuide.title,
    tutorInstructions: input.sourcePracticeGuide.tutorInstructions,
    userId: input.userId,
  });
}

export function findPracticeGuideShareLinkById(
  id: string,
): StoredPracticeGuideShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, practice_guide_id, created_at, revoked_at
        FROM practice_guide_share_links
        WHERE id = ?
      `,
    )
    .get(id) as PracticeGuideShareLinkRow | undefined;

  return row ? toStoredPracticeGuideShareLink(row) : null;
}

export function findPracticeGuideShareLinkForPracticeGuide(
  practiceGuideId: string,
): StoredPracticeGuideShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, practice_guide_id, created_at, revoked_at
        FROM practice_guide_share_links
        WHERE practice_guide_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(practiceGuideId) as PracticeGuideShareLinkRow | undefined;

  return row ? toStoredPracticeGuideShareLink(row) : null;
}

export function getOrCreatePracticeGuideShareLink(
  practiceGuideId: string,
): StoredPracticeGuideShareLink {
  const existing = findPracticeGuideShareLinkForPracticeGuide(practiceGuideId);
  if (existing) {
    upsertResourceShareLink(getDb(), existing.id, practiceGuideId);
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO practice_guide_share_links (id, practice_guide_id)
        VALUES (?, ?)
        ON CONFLICT(practice_guide_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
      .run(id, practiceGuideId);
    upsertResourceShareLink(db, id, practiceGuideId);
  });

  transaction();

  const created = findPracticeGuideShareLinkForPracticeGuide(practiceGuideId);
  if (!created) {
    throw new Error('Could not load newly created practice-guide share link.');
  }

  return created;
}

export function createConversationPracticeGuideSnapshot(
  conversationId: string,
  practiceGuide: StoredPracticeGuide,
): StoredConversationPracticeGuideSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_practice_guide_snapshots (
          conversation_id,
          practice_guide_id,
          title,
          description,
          tutor_instructions
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      practiceGuide.id,
      practiceGuide.title,
      practiceGuide.description,
      practiceGuide.tutorInstructions,
    );

  const snapshot = getConversationPracticeGuideSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation practice-guide snapshot.');
  }

  return snapshot;
}

export function createConversationChatRoomReportSnapshot(
  conversationId: string,
  input: {
    report: StoredChatRoomConversationReport;
    room: StoredChatRoom;
  },
): StoredConversationChatRoomReportSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_chat_room_report_snapshots (
          conversation_id,
          chat_room_conversation_report_id,
          chat_room_conversation_id,
          room_title,
          room_description,
          report_summary_title,
          report_summary_description,
          slides_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      input.report.id,
      input.report.conversationId,
      input.room.title,
      input.room.description,
      input.report.summaryTitle,
      input.report.summaryDescription,
      JSON.stringify(input.report.slides),
    );

  const snapshot = getConversationChatRoomReportSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation chat-room-report snapshot.');
  }

  return snapshot;
}

export function createConversationTutorReportSnapshot(
  conversationId: string,
  report: StoredTutorConversationReport,
): StoredConversationTutorReportSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_tutor_report_snapshots (
          conversation_id,
          tutor_conversation_report_id,
          source_conversation_id,
          report_summary_title,
          report_summary_description,
          report_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      report.id,
      report.conversationId,
      report.summaryTitle,
      report.summaryDescription,
      JSON.stringify(report.report),
    );

  const snapshot = getConversationTutorReportSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation tutor-report snapshot.');
  }

  return snapshot;
}

export function getConversationPracticeGuideSnapshot(
  conversationId: string,
): StoredConversationPracticeGuideSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT conversation_id, practice_guide_id, title, description, tutor_instructions, created_at
        FROM conversation_practice_guide_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationPracticeGuideSnapshotRow | undefined;

  return row ? toStoredConversationPracticeGuideSnapshot(row) : null;
}

export function getConversationChatRoomReportSnapshot(
  conversationId: string,
): StoredConversationChatRoomReportSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          conversation_id,
          chat_room_conversation_report_id,
          chat_room_conversation_id,
          room_title,
          room_description,
          report_summary_title,
          report_summary_description,
          slides_json,
          created_at
        FROM conversation_chat_room_report_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationChatRoomReportSnapshotRow | undefined;

  return row ? toStoredConversationChatRoomReportSnapshot(row) : null;
}

export function getConversationTutorReportSnapshot(
  conversationId: string,
): StoredConversationTutorReportSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          conversation_id,
          tutor_conversation_report_id,
          source_conversation_id,
          report_summary_title,
          report_summary_description,
          report_json,
          created_at
        FROM conversation_tutor_report_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationTutorReportSnapshotRow | undefined;

  return row ? toStoredConversationTutorReportSnapshot(row) : null;
}

export function listMessages(conversationId: string): StoredMessage[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(conversationId) as MessageRow[];

  return rows.map(toStoredMessage);
}

export function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  metadata: Record<string, unknown> | null = null,
): StoredMessage {
  const db = getDb();
  const insert = db.prepare(
    `
      INSERT INTO messages (conversation_id, role, content, metadata)
      VALUES (?, ?, ?, ?)
    `,
  );
  const result = insert.run(
    conversationId,
    role,
    content,
    metadata ? JSON.stringify(metadata) : null,
  );

  touchConversation(conversationId);

  const row = db
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ?
      `,
    )
    .get(result.lastInsertRowid) as MessageRow;

  return toStoredMessage(row);
}

export function findMessageInConversation(
  messageId: number,
  conversationId: string,
): StoredMessage | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .get(messageId, conversationId) as MessageRow | undefined;

  return row ? toStoredMessage(row) : null;
}

export function updateMessageMetadata(
  messageId: number,
  conversationId: string,
  metadataPatch: Record<string, unknown>,
): StoredMessage | null {
  const db = getDb();
  const existing = db
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .get(messageId, conversationId) as MessageRow | undefined;

  if (!existing) {
    return null;
  }

  const currentMetadata = existing.metadata
    ? parseMetadata(existing.metadata)
    : null;
  const nextMetadata = {
    ...(currentMetadata ?? {}),
    ...metadataPatch,
  };

  db.prepare(
    `
      UPDATE messages
      SET metadata = ?
      WHERE id = ? AND conversation_id = ?
    `,
  ).run(JSON.stringify(nextMetadata), messageId, conversationId);

  const updated = db
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .get(messageId, conversationId) as MessageRow | undefined;

  return updated ? toStoredMessage(updated) : null;
}

export function getConversationTutorPlan(
  conversationId: string,
): StoredTutorPlan | null {
  const row = getDb()
    .prepare(
      `
        SELECT conversation_id, plan_json, created_at, updated_at
        FROM conversation_tutor_plans
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationTutorPlanRow | undefined;

  return row ? toStoredTutorPlan(row) : null;
}

export function saveConversationTutorPlan(input: {
  conversationId: string;
  plan: Omit<StoredTutorPlan, 'conversationId' | 'createdAt' | 'updatedAt'>;
}): StoredTutorPlan {
  const planJson = JSON.stringify({
    steps: input.plan.steps,
    summary: input.plan.summary,
    title: input.plan.title,
  });

  getDb()
    .prepare(
      `
        INSERT INTO conversation_tutor_plans (conversation_id, plan_json)
        VALUES (?, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET
          plan_json = excluded.plan_json,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(input.conversationId, planJson);

  touchConversation(input.conversationId);

  const plan = getConversationTutorPlan(input.conversationId);
  if (!plan) {
    throw new Error('Tutor plan was not saved.');
  }

  return plan;
}

export function deleteConversationTutorPlan(conversationId: string): void {
  getDb()
    .prepare(
      `
        DELETE FROM conversation_tutor_plans
        WHERE conversation_id = ?
      `,
    )
    .run(conversationId);

  touchConversation(conversationId);
}

export function listChatRoomMessages(
  conversationId: string,
): StoredChatRoomMessage[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          sender_type,
          sender_name,
          content,
          evaluation_status,
          evaluation_problem,
          evaluation_created_at,
          created_at
        FROM chat_room_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(conversationId) as ChatRoomMessageRow[];

  return rows.map(toStoredChatRoomMessage);
}

export function findChatRoomMessage(
  conversationId: string,
  messageId: number,
): StoredChatRoomMessage | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          sender_type,
          sender_name,
          content,
          evaluation_status,
          evaluation_problem,
          evaluation_created_at,
          created_at
        FROM chat_room_messages
        WHERE conversation_id = ? AND id = ?
      `,
    )
    .get(conversationId, messageId) as ChatRoomMessageRow | undefined;

  return row ? toStoredChatRoomMessage(row) : null;
}

export function addChatRoomMessage(
  conversationId: string,
  senderType: ChatRoomMessageSenderType,
  senderName: string,
  content: string,
): StoredChatRoomMessage {
  const db = getDb();
  const result = db
    .prepare(
      `
        INSERT INTO chat_room_messages (conversation_id, sender_type, sender_name, content)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(conversationId, senderType, senderName, content);

  touchChatRoomConversation(conversationId);

  const row = db
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          sender_type,
          sender_name,
          content,
          evaluation_status,
          evaluation_problem,
          evaluation_created_at,
          created_at
        FROM chat_room_messages
        WHERE id = ?
      `,
    )
    .get(result.lastInsertRowid) as ChatRoomMessageRow;

  return toStoredChatRoomMessage(row);
}

export function updateChatRoomMessageEvaluation(input: {
  conversationId: string;
  messageId: number;
  status: ChatRoomMessageEvaluationStatus;
  problem?: string | null;
}): StoredChatRoomMessage | null {
  const db = getDb();
  db.prepare(
    `
      UPDATE chat_room_messages
      SET evaluation_status = ?,
          evaluation_problem = ?,
          evaluation_created_at = CURRENT_TIMESTAMP
      WHERE id = ? AND conversation_id = ?
    `,
  ).run(
    input.status,
    input.status === 'warning' ? (input.problem?.trim() || null) : null,
    input.messageId,
    input.conversationId,
  );

  const row = db.prepare(
    `
      SELECT
        id,
        conversation_id,
        sender_type,
        sender_name,
        content,
        evaluation_status,
        evaluation_problem,
        evaluation_created_at,
        created_at
      FROM chat_room_messages
      WHERE id = ? AND conversation_id = ?
    `,
  ).get(input.messageId, input.conversationId) as ChatRoomMessageRow | undefined;

  return row ? toStoredChatRoomMessage(row) : null;
}

function parseMetadata(metadata: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseTutorPlanJson(
  planJson: string,
): Omit<StoredTutorPlan, 'conversationId' | 'createdAt' | 'updatedAt'> | null {
  try {
    const parsed = JSON.parse(planJson) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const summary =
      typeof record.summary === 'string' && record.summary.trim()
        ? record.summary.trim()
        : undefined;
    const rawSteps = Array.isArray(record.steps) ? record.steps : [];
    const steps = rawSteps
      .map((step): StoredTutorPlanStep | null => {
        if (!step || typeof step !== 'object') {
          return null;
        }

        const stepRecord = step as Record<string, unknown>;
        const id = typeof stepRecord.id === 'string' ? stepRecord.id.trim() : '';
        const label = typeof stepRecord.label === 'string' ? stepRecord.label.trim() : '';
        const status = stepRecord.status;
        if (
          !id ||
          !label ||
          (
            status !== 'active' &&
            status !== 'done' &&
            status !== 'pending' &&
            status !== 'skipped'
          )
        ) {
          return null;
        }

        return {
          id,
          label,
          status,
        };
      })
      .filter((step): step is StoredTutorPlanStep => Boolean(step));

    if (!title || steps.length === 0) {
      return null;
    }

    return {
      steps,
      summary,
      title,
    };
  } catch {
    return null;
  }
}
