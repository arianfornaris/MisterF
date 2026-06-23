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
  practiceModuleId: string | null;
  id: string;
  modelTier: 'advanced' | 'max' | 'regular';
  profileId: string;
  titleUpdatedByUser: boolean;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
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
  reportPracticeModuleId: string | null;
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
  practiceModuleId: string | null;
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

export type StoredPracticeModule = {
  archivedAt: string | null;
  collectionId: string | null;
  id: string;
  isFavorite: boolean;
  positionInCollection: number | null;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourcePracticeModuleId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPracticeModuleCollection = {
  archivedAt: string | null;
  id: string;
  isFavorite: boolean;
  userId: string;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourceCollectionId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPracticeModuleCollectionItem = {
  collectionId: string;
  practiceModuleId: string;
  position: number;
  createdAt: string;
};

export type StoredPracticeModuleShareLink = {
  practiceModuleId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredPracticeModuleCollectionShareLink = {
  collectionId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredConversationPracticeModuleSnapshot = {
  practiceModuleId: string | null;
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
  practiceModuleId: string | null;
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

export type StoredAssignment = {
  archivedAt: string | null;
  createdAt: string;
  description: string;
  id: string;
  instructions: string;
  isFavorite: boolean;
  level: string;
  profileId: string;
  quiz: Record<string, unknown>;
  sharedVia: 'link' | 'profile' | null;
  sourceAssignmentId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  targetTopic: string;
  title: string;
  updatedAt: string;
  userId: string;
};

export type StoredAssignmentShareLink = {
  assignmentId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredAssignmentAttempt = {
  assignmentId: string;
  claimToken: string | null;
  createdAt: string;
  evaluatedAt: string | null;
  guestToken: string | null;
  id: string;
  isPreview: boolean;
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

export type StoredConversationAssignmentAttemptSnapshot = {
  assignmentAttemptId: string;
  assignmentDescription: string;
  assignmentSnapshot: Record<string, unknown>;
  assignmentTargetTopic: string;
  assignmentTitle: string;
  conversationId: string;
  createdAt: string;
  responses: unknown[];
  result: Record<string, unknown>;
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
  vocabulary: string[];
};

export type LearnerProgressSourceType =
  | 'assignment_attempt'
  | 'chat_room_conversation_report'
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
  report_practice_module_id: string | null;
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
  practice_module_id: string | null;
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
  practice_module_id: string | null;
  id: string;
  model_tier: 'advanced' | 'max' | 'regular';
  profile_id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type TutorConversationReportRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  profile_id: string;
  summary_title: string;
  summary_description: string;
  report_json: string;
  practice_module_id: string | null;
  created_at: string;
  updated_at: string;
};

type PracticeModuleRow = {
  archived_at: string | null;
  collection_id: string | null;
  id: string;
  is_favorite: number;
  position_in_collection: number | null;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_practice_module_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  user_id: string;
  title: string;
  description: string;
  tutor_instructions: string;
  created_at: string;
  updated_at: string;
};

type PracticeModuleShareLinkRow = {
  practice_module_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type PracticeModuleCollectionRow = {
  archived_at: string | null;
  id: string;
  is_favorite: number;
  user_id: string;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_collection_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type PracticeModuleCollectionItemRow = {
  collection_id: string;
  practice_module_id: string;
  position: number;
  created_at: string;
};

type ConversationPracticeModuleSnapshotRow = {
  practice_module_id: string | null;
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

type AssignmentRow = {
  archived_at: string | null;
  created_at: string;
  description: string;
  id: string;
  instructions: string;
  is_favorite: number;
  level: string;
  profile_id: string;
  quiz_json: string;
  shared_via: 'link' | 'profile' | null;
  source_assignment_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  target_topic: string;
  title: string;
  updated_at: string;
  user_id: string;
};

type AssignmentShareLinkRow = {
  assignment_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type AssignmentAttemptRow = {
  assignment_id: string;
  claim_token: string | null;
  created_at: string;
  evaluated_at: string | null;
  guest_token: string | null;
  id: string;
  is_preview: number;
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

type ConversationAssignmentAttemptSnapshotRow = {
  assignment_attempt_id: string;
  assignment_description: string;
  assignment_snapshot_json: string;
  assignment_target_topic: string;
  assignment_title: string;
  conversation_id: string;
  created_at: string;
  responses_json: string;
  result_json: string;
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

type PracticeModuleCollectionShareLinkRow = {
  collection_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
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
    practiceModuleId: row.practice_module_id,
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
    practiceModuleId: row.practice_module_id,
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

function toStoredAssignment(row: AssignmentRow): StoredAssignment {
  return {
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    instructions: row.instructions,
    isFavorite: Boolean(row.is_favorite),
    level: row.level,
    profileId: row.profile_id,
    quiz: parseJsonRecord(row.quiz_json),
    sharedVia: row.shared_via,
    sourceAssignmentId: row.source_assignment_id,
    sourceProfileId: row.source_profile_id,
    sourceUserId: row.source_user_id,
    targetTopic: row.target_topic,
    title: row.title,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toStoredAssignmentShareLink(
  row: AssignmentShareLinkRow,
): StoredAssignmentShareLink {
  return {
    assignmentId: row.assignment_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredAssignmentAttempt(row: AssignmentAttemptRow): StoredAssignmentAttempt {
  return {
    assignmentId: row.assignment_id,
    claimToken: row.claim_token,
    createdAt: row.created_at,
    evaluatedAt: row.evaluated_at,
    guestToken: row.guest_token,
    id: row.id,
    isPreview: Boolean(row.is_preview),
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

function toStoredConversationAssignmentAttemptSnapshot(
  row: ConversationAssignmentAttemptSnapshotRow,
): StoredConversationAssignmentAttemptSnapshot {
  return {
    assignmentAttemptId: row.assignment_attempt_id,
    assignmentDescription: row.assignment_description,
    assignmentSnapshot: parseJsonRecord(row.assignment_snapshot_json),
    assignmentTargetTopic: row.assignment_target_topic,
    assignmentTitle: row.assignment_title,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    responses: parseJsonArray(row.responses_json),
    result: parseJsonRecord(row.result_json),
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
    return {
      difficulties: Array.isArray(parsed.difficulties) ? parsed.difficulties : [],
      practiced: Array.isArray(parsed.practiced) ? parsed.practiced : [],
      progress: Array.isArray(parsed.progress) ? parsed.progress : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
    };
  } catch {
    return fallback;
  }
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
    reportPracticeModuleId: row.report_practice_module_id,
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
    practiceModuleId: row.practice_module_id,
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

function toStoredPracticeModule(row: PracticeModuleRow): StoredPracticeModule {
  return {
    archivedAt: row.archived_at,
    collectionId: row.collection_id,
    id: row.id,
    isFavorite: Boolean(row.is_favorite),
    positionInCollection: row.position_in_collection,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourcePracticeModuleId: row.source_practice_module_id,
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

function toStoredPracticeModuleCollection(
  row: PracticeModuleCollectionRow,
): StoredPracticeModuleCollection {
  return {
    archivedAt: row.archived_at,
    id: row.id,
    isFavorite: Boolean(row.is_favorite),
    userId: row.user_id,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourceCollectionId: row.source_collection_id,
    sourceProfileId: row.source_profile_id,
    sourceUserId: row.source_user_id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredPracticeModuleCollectionItem(
  row: PracticeModuleCollectionItemRow,
): StoredPracticeModuleCollectionItem {
  return {
    collectionId: row.collection_id,
    practiceModuleId: row.practice_module_id,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toStoredPracticeModuleShareLink(
  row: PracticeModuleShareLinkRow,
): StoredPracticeModuleShareLink {
  return {
    practiceModuleId: row.practice_module_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredPracticeModuleCollectionShareLink(
  row: PracticeModuleCollectionShareLinkRow,
): StoredPracticeModuleCollectionShareLink {
  return {
    collectionId: row.collection_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredConversationPracticeModuleSnapshot(
  row: ConversationPracticeModuleSnapshotRow,
): StoredConversationPracticeModuleSnapshot {
  return {
    practiceModuleId: row.practice_module_id,
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
    practiceModuleId?: string | null;
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
          practice_module_id,
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
      options.practiceModuleId ?? null,
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

export function createConversationFromPracticeModule(
  userId: string,
  practiceModule: StoredPracticeModule,
): StoredConversation {
  const conversation = createConversation(
    userId,
    practiceModule.profileId,
    defaultConversationTitle,
    {
      practiceModuleId: practiceModule.id,
    },
  );

  createConversationPracticeModuleSnapshot(conversation.id, practiceModule);
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_module_id, profile_id, active_agent
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_module_id, profile_id, active_agent
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
          r.practice_module_id AS report_practice_module_id
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
          r.practice_module_id AS report_practice_module_id
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
          r.practice_module_id AS report_practice_module_id
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
          practice_module_id,
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

export function setChatRoomConversationReportPracticeModule(input: {
  conversationId: string;
  practiceModuleId: string | null;
  userId: string;
}): StoredChatRoomConversationReport | null {
  getDb()
    .prepare(
      `
        UPDATE chat_room_conversation_reports
        SET practice_module_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `,
    )
    .run(input.practiceModuleId, input.conversationId, input.userId);

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
          practice_module_id,
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

export function setTutorConversationReportPracticeModule(input: {
  conversationId: string;
  practiceModuleId: string | null;
  userId: string;
}): StoredTutorConversationReport | null {
  getDb()
    .prepare(
      `
        UPDATE tutor_conversation_reports
        SET practice_module_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `,
    )
    .run(input.practiceModuleId, input.conversationId, input.userId);

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

export function createAssignment(input: {
  description?: string;
  instructions?: string;
  level?: string;
  profileId: string;
  quiz: Record<string, unknown>;
  sharedVia?: 'link' | 'profile' | null;
  sourceAssignmentId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  targetTopic?: string;
  title: string;
  userId: string;
}): StoredAssignment {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO assignments (
          id,
          user_id,
          profile_id,
          title,
          description,
          target_topic,
          level,
          instructions,
          quiz_json,
          source_assignment_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      input.sourceAssignmentId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

  const assignment = findAssignmentForUser(id, input.userId);
  if (!assignment) {
    throw new Error('Could not load newly created assignment.');
  }

  return assignment;
}

export function findAssignmentForUser(
  id: string,
  userId: string,
): StoredAssignment | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          created_at,
          description,
          id,
          instructions,
          is_favorite,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_assignment_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM assignments
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as AssignmentRow | undefined;

  return row ? toStoredAssignment(row) : null;
}

export function findAssignmentById(id: string): StoredAssignment | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          created_at,
          description,
          id,
          instructions,
          is_favorite,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_assignment_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM assignments
        WHERE id = ?
      `,
    )
    .get(id) as AssignmentRow | undefined;

  return row ? toStoredAssignment(row) : null;
}

export function listAssignmentsForProfile(input: {
  includeArchived?: boolean;
  profileId: string;
  userId: string;
}): StoredAssignment[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          created_at,
          description,
          id,
          instructions,
          is_favorite,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_assignment_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM assignments
        WHERE user_id = ?
          AND profile_id = ?
          AND (? = 1 OR archived_at IS NULL)
        ORDER BY
          CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END ASC,
          is_favorite DESC,
          updated_at DESC,
          created_at DESC
      `,
    )
    .all(input.userId, input.profileId, input.includeArchived ? 1 : 0) as AssignmentRow[];

  return rows.map(toStoredAssignment);
}

export function updateAssignment(input: {
  assignmentId: string;
  description: string;
  instructions: string;
  level: string;
  quiz: Record<string, unknown>;
  targetTopic: string;
  title: string;
  userId: string;
}): StoredAssignment | null {
  getDb()
    .prepare(
      `
        UPDATE assignments
        SET title = ?,
            description = ?,
            target_topic = ?,
            level = ?,
            instructions = ?,
            quiz_json = ?,
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
      input.assignmentId,
      input.userId,
    );

  return findAssignmentForUser(input.assignmentId, input.userId);
}

export function findImportedAssignmentForProfile(input: {
  profileId: string;
  sourceAssignmentId: string;
  userId: string;
}): StoredAssignment | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          created_at,
          description,
          id,
          instructions,
          is_favorite,
          level,
          profile_id,
          quiz_json,
          shared_via,
          source_assignment_id,
          source_profile_id,
          source_user_id,
          target_topic,
          title,
          updated_at,
          user_id
        FROM assignments
        WHERE user_id = ?
          AND profile_id = ?
          AND source_assignment_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourceAssignmentId) as
    | AssignmentRow
    | undefined;

  return row ? toStoredAssignment(row) : null;
}

export function importAssignmentToProfile(input: {
  shareKind: 'profile' | 'link';
  sourceAssignment: StoredAssignment;
  targetProfileId: string;
  userId: string;
}): StoredAssignment {
  const existing = findImportedAssignmentForProfile({
    profileId: input.targetProfileId,
    sourceAssignmentId: input.sourceAssignment.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  return createAssignment({
    description: input.sourceAssignment.description,
    instructions: input.sourceAssignment.instructions,
    level: input.sourceAssignment.level,
    profileId: input.targetProfileId,
    quiz: input.sourceAssignment.quiz,
    sharedVia: input.shareKind,
    sourceAssignmentId: input.sourceAssignment.id,
    sourceProfileId: input.sourceAssignment.profileId,
    sourceUserId: input.sourceAssignment.userId,
    targetTopic: input.sourceAssignment.targetTopic,
    title: input.sourceAssignment.title,
    userId: input.userId,
  });
}

export function setAssignmentFavoriteForUser(
  assignmentId: string,
  userId: string,
  isFavorite: boolean,
): StoredAssignment | null {
  getDb()
    .prepare(
      `
        UPDATE assignments
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(isFavorite ? 1 : 0, assignmentId, userId);

  return findAssignmentForUser(assignmentId, userId);
}

export function archiveAssignmentForUser(
  assignmentId: string,
  userId: string,
): StoredAssignment | null {
  getDb()
    .prepare(
      `
        UPDATE assignments
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(assignmentId, userId);

  return findAssignmentForUser(assignmentId, userId);
}

export function restoreAssignmentForUser(
  assignmentId: string,
  userId: string,
): StoredAssignment | null {
  getDb()
    .prepare(
      `
        UPDATE assignments
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(assignmentId, userId);

  return findAssignmentForUser(assignmentId, userId);
}

export function findAssignmentShareLinkById(
  id: string,
): StoredAssignmentShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, assignment_id, created_at, revoked_at
        FROM assignment_share_links
        WHERE id = ?
      `,
    )
    .get(id) as AssignmentShareLinkRow | undefined;

  return row ? toStoredAssignmentShareLink(row) : null;
}

export function findAssignmentShareLinkForAssignment(
  assignmentId: string,
): StoredAssignmentShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, assignment_id, created_at, revoked_at
        FROM assignment_share_links
        WHERE assignment_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(assignmentId) as AssignmentShareLinkRow | undefined;

  return row ? toStoredAssignmentShareLink(row) : null;
}

export function getOrCreateAssignmentShareLink(
  assignmentId: string,
): StoredAssignmentShareLink {
  const existing = findAssignmentShareLinkForAssignment(assignmentId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO assignment_share_links (id, assignment_id)
        VALUES (?, ?)
        ON CONFLICT(assignment_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, assignmentId);

  const created = findAssignmentShareLinkForAssignment(assignmentId);
  if (!created) {
    throw new Error('Could not load newly created assignment share link.');
  }

  return created;
}

export function createAssignmentAttempt(input: {
  assignmentId: string;
  isPreview?: boolean;
  profileId?: string | null;
  snapshot: Record<string, unknown>;
  userId?: string | null;
}): StoredAssignmentAttempt {
  const id = randomUUID();
  const isGuest = !input.userId;
  const guestToken = isGuest ? randomBytes(24).toString('base64url') : null;
  const claimToken = isGuest ? randomBytes(24).toString('base64url') : null;
  getDb()
    .prepare(
      `
        INSERT INTO assignment_attempts (
          id,
          assignment_id,
          user_id,
          profile_id,
          guest_token,
          claim_token,
          is_preview,
          snapshot_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.assignmentId,
      input.userId ?? null,
      input.profileId ?? null,
      guestToken,
      claimToken,
      input.isPreview ? 1 : 0,
      JSON.stringify(input.snapshot),
    );

  const attempt = findAssignmentAttemptById(id);
  if (!attempt) {
    throw new Error('Could not load newly created assignment attempt.');
  }

  return attempt;
}

export function findAssignmentAttemptById(id: string): StoredAssignmentAttempt | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          assignment_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          is_preview,
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
        FROM assignment_attempts
        WHERE id = ?
      `,
    )
    .get(id) as AssignmentAttemptRow | undefined;

  return row ? toStoredAssignmentAttempt(row) : null;
}

export function findAssignmentAttemptForUser(
  id: string,
  userId: string,
): StoredAssignmentAttempt | null {
  const attempt = findAssignmentAttemptById(id);
  return attempt?.userId === userId ? attempt : null;
}

export function findAssignmentAttemptByGuestToken(
  guestToken: string,
): StoredAssignmentAttempt | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          assignment_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          is_preview,
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
        FROM assignment_attempts
        WHERE guest_token = ?
      `,
    )
    .get(guestToken) as AssignmentAttemptRow | undefined;

  return row ? toStoredAssignmentAttempt(row) : null;
}

export function findAssignmentAttemptByClaimToken(
  claimToken: string,
): StoredAssignmentAttempt | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          assignment_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          is_preview,
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
        FROM assignment_attempts
        WHERE claim_token = ?
      `,
    )
    .get(claimToken) as AssignmentAttemptRow | undefined;

  return row ? toStoredAssignmentAttempt(row) : null;
}

export function listAssignmentAttemptsForUser(input: {
  assignmentId?: string;
  includePreview?: boolean;
  profileId: string;
  userId: string;
}): StoredAssignmentAttempt[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          assignment_id,
          claim_token,
          created_at,
          evaluated_at,
          guest_token,
          id,
          is_preview,
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
        FROM assignment_attempts
        WHERE user_id = ?
          AND profile_id = ?
          AND (? IS NULL OR assignment_id = ?)
          AND (? = 1 OR is_preview = 0)
        ORDER BY created_at DESC
      `,
    )
    .all(
      input.userId,
      input.profileId,
      input.assignmentId ?? null,
      input.assignmentId ?? null,
      input.includePreview ? 1 : 0,
    ) as AssignmentAttemptRow[];

  return rows.map(toStoredAssignmentAttempt);
}

export function submitAssignmentAttempt(input: {
  attemptId: string;
  responses: unknown[];
}): StoredAssignmentAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE assignment_attempts
        SET responses_json = ?,
            status = 'submitted',
            submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('draft', 'failed')
      `,
    )
    .run(JSON.stringify(input.responses), input.attemptId);

  return findAssignmentAttemptById(input.attemptId);
}

export function markAssignmentAttemptEvaluating(
  attemptId: string,
): StoredAssignmentAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE assignment_attempts
        SET status = 'evaluating',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(attemptId);

  return findAssignmentAttemptById(attemptId);
}

export function saveAssignmentAttemptResult(input: {
  attemptId: string;
  result: Record<string, unknown>;
}): StoredAssignmentAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE assignment_attempts
        SET result_json = ?,
            status = 'evaluated',
            evaluated_at = COALESCE(evaluated_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(JSON.stringify(input.result), input.attemptId);

  return findAssignmentAttemptById(input.attemptId);
}

export function markAssignmentAttemptFailed(
  attemptId: string,
): StoredAssignmentAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE assignment_attempts
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(attemptId);

  return findAssignmentAttemptById(attemptId);
}

export function attachAssignmentAttemptToUser(input: {
  attemptId: string;
  claimToken: string;
  profileId: string;
  userId: string;
}): StoredAssignmentAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE assignment_attempts
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

  return findAssignmentAttemptById(input.attemptId);
}

export function setAssignmentAttemptProgressEvent(input: {
  attemptId: string;
  progressEventId: number;
}): StoredAssignmentAttempt | null {
  getDb()
    .prepare(
      `
        UPDATE assignment_attempts
        SET progress_event_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(input.progressEventId, input.attemptId);

  return findAssignmentAttemptById(input.attemptId);
}

export function createConversationFromAssignmentAttempt(input: {
  attempt: StoredAssignmentAttempt;
  profileId: string;
  userId: string;
}): StoredConversation {
  const title = readStringFromRecord(input.attempt.snapshot, 'title') || defaultConversationTitle;
  const conversation = createConversation(
    input.userId,
    input.profileId,
    `Practicar: ${title}`,
  );

  createConversationAssignmentAttemptSnapshot(conversation.id, input.attempt);
  return conversation;
}

export function createConversationAssignmentAttemptSnapshot(
  conversationId: string,
  attempt: StoredAssignmentAttempt,
): StoredConversationAssignmentAttemptSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_assignment_attempt_snapshots (
          conversation_id,
          assignment_attempt_id,
          assignment_title,
          assignment_description,
          assignment_target_topic,
          assignment_snapshot_json,
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

  const snapshot = getConversationAssignmentAttemptSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation assignment-attempt snapshot.');
  }

  return snapshot;
}

export function getConversationAssignmentAttemptSnapshot(
  conversationId: string,
): StoredConversationAssignmentAttemptSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          assignment_attempt_id,
          assignment_description,
          assignment_snapshot_json,
          assignment_target_topic,
          assignment_title,
          conversation_id,
          created_at,
          responses_json,
          result_json
        FROM conversation_assignment_attempt_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationAssignmentAttemptSnapshotRow | undefined;

  return row ? toStoredConversationAssignmentAttemptSnapshot(row) : null;
}

function readStringFromRecord(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

export function createPracticeModule(input: {
  collectionId?: string | null;
  positionInCollection?: number | null;
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourcePracticeModuleId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
}): StoredPracticeModule {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO practice_modules (
          id,
          user_id,
          profile_id,
          title,
          description,
          tutor_instructions,
          collection_id,
          position_in_collection,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.userId,
      input.profileId,
      input.title,
      input.description,
      input.tutorInstructions,
      input.collectionId ?? null,
      input.positionInCollection ?? null,
      input.sourcePracticeModuleId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

  const practiceModule = findPracticeModuleForUser(id, input.userId);
  if (!practiceModule) {
    throw new Error('Could not load newly created practice module.');
  }

  return practiceModule;
}

export function findPracticeModuleForUser(
  id: string,
  userId: string,
): StoredPracticeModule | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as PracticeModuleRow | undefined;

  return row ? toStoredPracticeModule(row) : null;
}

export function findPracticeModuleById(id: string): StoredPracticeModule | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleRow | undefined;

  return row ? toStoredPracticeModule(row) : null;
}

export function listPracticeModulesForProfile(
  userId: string,
  profileId: string,
): StoredPracticeModule[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as PracticeModuleRow[];

  return rows.map(toStoredPracticeModule);
}

export function createPracticeModuleCollection(input: {
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourceCollectionId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  userId: string;
  title: string;
  description: string;
}): StoredPracticeModuleCollection {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO practice_module_collections (
          id,
          user_id,
          profile_id,
          title,
          description,
          is_favorite,
          archived_at,
          source_collection_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.userId,
      input.profileId,
      input.title,
      input.description,
      input.sourceCollectionId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

  const collection = findPracticeModuleCollectionForUser(id, input.userId);
  if (!collection) {
    throw new Error('Could not load newly created practice module collection.');
  }

  return collection;
}

export function findPracticeModuleCollectionForUser(
  id: string,
  userId: string,
): StoredPracticeModuleCollection | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as PracticeModuleCollectionRow | undefined;

  return row ? toStoredPracticeModuleCollection(row) : null;
}

export function findPracticeModuleCollectionById(
  id: string,
): StoredPracticeModuleCollection | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleCollectionRow | undefined;

  return row ? toStoredPracticeModuleCollection(row) : null;
}

export function listPracticeModuleCollectionsForProfile(
  userId: string,
  profileId: string,
): StoredPracticeModuleCollection[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as PracticeModuleCollectionRow[];

  return rows.map(toStoredPracticeModuleCollection);
}

export function updatePracticeModuleCollection(input: {
  collectionId: string;
  userId: string;
  title: string;
  description: string;
}): StoredPracticeModuleCollection | null {
  getDb()
    .prepare(
      `
        UPDATE practice_module_collections
        SET title = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(input.title, input.description, input.collectionId, input.userId);

  return findPracticeModuleCollectionForUser(input.collectionId, input.userId);
}

export function findImportedPracticeModuleCollectionForProfile(input: {
  profileId: string;
  sourceCollectionId: string;
  userId: string;
}): StoredPracticeModuleCollection | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE user_id = ?
          AND profile_id = ?
          AND source_collection_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourceCollectionId) as
    | PracticeModuleCollectionRow
    | undefined;

  return row ? toStoredPracticeModuleCollection(row) : null;
}

export function setPracticeModuleCollectionFavoriteForUser(
  collectionId: string,
  userId: string,
  isFavorite: boolean,
): StoredPracticeModuleCollection | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_module_collections
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(isFavorite ? 1 : 0, collectionId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleCollectionForUser(collectionId, userId);
}

export function archivePracticeModuleCollectionForUser(
  collectionId: string,
  userId: string,
): StoredPracticeModuleCollection | null {
  const collection = findPracticeModuleCollectionForUser(collectionId, userId);
  if (!collection) {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE practice_module_collections
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(collectionId, userId);

    db.prepare(
      `
        UPDATE practice_modules
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND collection_id = ?
      `,
    ).run(userId, collectionId);
  });

  transaction();
  return findPracticeModuleCollectionForUser(collectionId, userId);
}

export function restorePracticeModuleCollectionForUser(
  collectionId: string,
  userId: string,
): StoredPracticeModuleCollection | null {
  const collection = findPracticeModuleCollectionForUser(collectionId, userId);
  if (!collection) {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE practice_module_collections
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(collectionId, userId);

    db.prepare(
      `
        UPDATE practice_modules
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND collection_id = ?
      `,
    ).run(userId, collectionId);
  });

  transaction();
  return findPracticeModuleCollectionForUser(collectionId, userId);
}

export function listPracticeModuleCollectionItems(
  collectionId: string,
  userId: string,
): StoredPracticeModuleCollectionItem[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          collection_id,
          id AS practice_module_id,
          COALESCE(position_in_collection, 0) AS position,
          created_at
        FROM practice_modules
        WHERE collection_id = ?
          AND user_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `,
    )
    .all(collectionId, userId) as PracticeModuleCollectionItemRow[];

  return rows.map(toStoredPracticeModuleCollectionItem);
}

export function listPracticeModulesForCollection(
  collectionId: string,
  userId: string,
): Array<StoredPracticeModuleCollectionItem & { practiceModule: StoredPracticeModule }> {
  return listPracticeModuleCollectionItems(collectionId, userId)
    .map((item) => {
      const practiceModule = findPracticeModuleForUser(item.practiceModuleId, userId);
      return practiceModule ? { ...item, practiceModule } : null;
    })
    .filter((entry): entry is StoredPracticeModuleCollectionItem & { practiceModule: StoredPracticeModule } => Boolean(entry));
}

function listPracticeModulesByCollectionId(
  collectionId: string,
): StoredPracticeModule[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE collection_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `,
    )
    .all(collectionId) as PracticeModuleRow[];

  return rows.map(toStoredPracticeModule);
}

function normalizePracticeModuleCollectionPositions(collectionId: string): void {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          collection_id,
          id AS practice_module_id,
          COALESCE(position_in_collection, 0) AS position,
          created_at
        FROM practice_modules
        WHERE collection_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `,
    )
    .all(collectionId) as PracticeModuleCollectionItemRow[];

  const update = db.prepare(
    `
      UPDATE practice_modules
      SET position_in_collection = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE collection_id = ? AND id = ?
    `,
  );

  rows.forEach((row, index) => {
    update.run(index + 1, row.collection_id, row.practice_module_id);
  });
}

export function listPracticeModuleCollectionsContainingModule(
  practiceModuleId: string,
  userId: string,
): StoredPracticeModuleCollection[] {
  const practiceModule = findPracticeModuleForUser(practiceModuleId, userId);
  if (!practiceModule?.collectionId) {
    return [];
  }

  const collection = findPracticeModuleCollectionForUser(practiceModule.collectionId, userId);
  return collection ? [collection] : [];
}

export function addPracticeModuleToCollection(input: {
  collectionId: string;
  practiceModuleId: string;
  userId: string;
}): boolean {
  const collection = findPracticeModuleCollectionForUser(input.collectionId, input.userId);
  const practiceModule = findPracticeModuleForUser(input.practiceModuleId, input.userId);
  if (!collection || !practiceModule || collection.profileId !== practiceModule.profileId) {
    return false;
  }

  const db = getDb();
  if (practiceModule.collectionId === input.collectionId) {
    return true;
  }

  const nextPositionRow = db
    .prepare(
      `
        SELECT COALESCE(MAX(position), 0) AS max_position
        FROM practice_modules
        WHERE collection_id = ?
      `,
    )
    .get(input.collectionId) as { max_position: number };

  const previousCollectionId = practiceModule.collectionId;
  db.prepare(
    `
      UPDATE practice_modules
      SET collection_id = ?,
          position_in_collection = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
  ).run(input.collectionId, nextPositionRow.max_position + 1, input.practiceModuleId, input.userId);

  if (previousCollectionId) {
    normalizePracticeModuleCollectionPositions(previousCollectionId);
  }

  db.prepare(
    `
      UPDATE practice_module_collections
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id IN (?, ?)
    `,
  ).run(input.collectionId, previousCollectionId ?? input.collectionId);

  return true;
}

export function removePracticeModuleFromCollection(input: {
  collectionId: string;
  practiceModuleId: string;
  userId: string;
}): boolean {
  const collection = findPracticeModuleCollectionForUser(input.collectionId, input.userId);
  if (!collection) {
    return false;
  }

  const db = getDb();
  const result = db.prepare(
    `
      UPDATE practice_modules
      SET collection_id = NULL,
          position_in_collection = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE collection_id = ? AND id = ? AND user_id = ?
    `,
  ).run(input.collectionId, input.practiceModuleId, input.userId);

  if (result.changes < 1) {
    return false;
  }

  normalizePracticeModuleCollectionPositions(input.collectionId);
  db.prepare(
    `
      UPDATE practice_module_collections
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(input.collectionId);

  return true;
}

export function movePracticeModuleCollectionItem(input: {
  collectionId: string;
  practiceModuleId: string;
  userId: string;
  direction: 'up' | 'down';
}): boolean {
  const collection = findPracticeModuleCollectionForUser(input.collectionId, input.userId);
  if (!collection) {
    return false;
  }

  const items = listPracticeModuleCollectionItems(input.collectionId, input.userId);
  const index = items.findIndex((item) => item.practiceModuleId === input.practiceModuleId);
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
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `,
    ).run(-1, input.collectionId, current.practiceModuleId);

    db.prepare(
      `
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `,
    ).run(current.position, input.collectionId, other.practiceModuleId);

    db.prepare(
      `
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `,
    ).run(other.position, input.collectionId, current.practiceModuleId);

    db.prepare(
      `
        UPDATE practice_module_collections
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(input.collectionId);
  });

  transaction();
  return true;
}

export function deletePracticeModuleForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM practice_modules WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function setPracticeModuleFavoriteForUser(
  practiceModuleId: string,
  userId: string,
  isFavorite: boolean,
): StoredPracticeModule | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_modules
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(isFavorite ? 1 : 0, practiceModuleId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleForUser(practiceModuleId, userId);
}

export function archivePracticeModuleForUser(
  practiceModuleId: string,
  userId: string,
): StoredPracticeModule | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_modules
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(practiceModuleId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleForUser(practiceModuleId, userId);
}

export function restorePracticeModuleForUser(
  practiceModuleId: string,
  userId: string,
): StoredPracticeModule | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_modules
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(practiceModuleId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleForUser(practiceModuleId, userId);
}

export function listConversationsForPracticeModule(
  practiceModuleId: string,
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_module_id, profile_id, active_agent, model_tier, chat_room_conversation_report_id
        FROM conversations
        WHERE user_id = ? AND profile_id = ? AND practice_module_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId, practiceModuleId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function updatePracticeModule(input: {
  practiceModuleId: string;
  description: string;
  title: string;
  tutorInstructions: string;
  userId: string;
}): StoredPracticeModule | null {
  getDb()
    .prepare(
      `
        UPDATE practice_modules
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
      input.practiceModuleId,
      input.userId,
    );

  return findPracticeModuleForUser(input.practiceModuleId, input.userId);
}

export function findImportedPracticeModuleForProfile(input: {
  profileId: string;
  sourcePracticeModuleId: string;
  userId: string;
}): StoredPracticeModule | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE user_id = ?
          AND profile_id = ?
          AND source_practice_module_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourcePracticeModuleId) as
    | PracticeModuleRow
    | undefined;

  return row ? toStoredPracticeModule(row) : null;
}

export function importPracticeModuleToProfile(input: {
  shareKind: 'profile' | 'link';
  sourcePracticeModule: StoredPracticeModule;
  targetProfileId: string;
  userId: string;
}): StoredPracticeModule {
  const existing = findImportedPracticeModuleForProfile({
    profileId: input.targetProfileId,
    sourcePracticeModuleId: input.sourcePracticeModule.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  return createPracticeModule({
    description: input.sourcePracticeModule.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourcePracticeModuleId: input.sourcePracticeModule.id,
    sourceProfileId: input.sourcePracticeModule.profileId,
    sourceUserId: input.sourcePracticeModule.userId,
    title: input.sourcePracticeModule.title,
    tutorInstructions: input.sourcePracticeModule.tutorInstructions,
    userId: input.userId,
  });
}

export function importPracticeModuleCollectionToProfile(input: {
  shareKind: 'profile' | 'link';
  sourceCollection: StoredPracticeModuleCollection;
  targetProfileId: string;
  userId: string;
}): StoredPracticeModuleCollection {
  const existing = findImportedPracticeModuleCollectionForProfile({
    profileId: input.targetProfileId,
    sourceCollectionId: input.sourceCollection.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  const importedCollection = createPracticeModuleCollection({
    description: input.sourceCollection.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourceCollectionId: input.sourceCollection.id,
    sourceProfileId: input.sourceCollection.profileId,
    sourceUserId: input.sourceCollection.userId,
    title: input.sourceCollection.title,
    userId: input.userId,
  });

  const sourceModules = listPracticeModulesByCollectionId(input.sourceCollection.id);
  sourceModules.forEach((sourceModule, index) => {
    createPracticeModule({
      collectionId: importedCollection.id,
      description: sourceModule.description,
      positionInCollection: index + 1,
      profileId: input.targetProfileId,
      sharedVia: input.shareKind,
      sourcePracticeModuleId: sourceModule.id,
      sourceProfileId: sourceModule.profileId,
      sourceUserId: sourceModule.userId,
      title: sourceModule.title,
      tutorInstructions: sourceModule.tutorInstructions,
      userId: input.userId,
    });
  });

  return importedCollection;
}

export function findPracticeModuleShareLinkById(
  id: string,
): StoredPracticeModuleShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, practice_module_id, created_at, revoked_at
        FROM practice_module_share_links
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleShareLinkRow | undefined;

  return row ? toStoredPracticeModuleShareLink(row) : null;
}

export function findPracticeModuleCollectionShareLinkById(
  id: string,
): StoredPracticeModuleCollectionShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, collection_id, created_at, revoked_at
        FROM practice_module_collection_share_links
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleCollectionShareLinkRow | undefined;

  return row ? toStoredPracticeModuleCollectionShareLink(row) : null;
}

export function findPracticeModuleShareLinkForPracticeModule(
  practiceModuleId: string,
): StoredPracticeModuleShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, practice_module_id, created_at, revoked_at
        FROM practice_module_share_links
        WHERE practice_module_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(practiceModuleId) as PracticeModuleShareLinkRow | undefined;

  return row ? toStoredPracticeModuleShareLink(row) : null;
}

export function findPracticeModuleCollectionShareLinkForCollection(
  collectionId: string,
): StoredPracticeModuleCollectionShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, collection_id, created_at, revoked_at
        FROM practice_module_collection_share_links
        WHERE collection_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(collectionId) as PracticeModuleCollectionShareLinkRow | undefined;

  return row ? toStoredPracticeModuleCollectionShareLink(row) : null;
}

export function getOrCreatePracticeModuleShareLink(
  practiceModuleId: string,
): StoredPracticeModuleShareLink {
  const existing = findPracticeModuleShareLinkForPracticeModule(practiceModuleId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO practice_module_share_links (id, practice_module_id)
        VALUES (?, ?)
        ON CONFLICT(practice_module_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, practiceModuleId);

  const created = findPracticeModuleShareLinkForPracticeModule(practiceModuleId);
  if (!created) {
    throw new Error('Could not load newly created practice-module share link.');
  }

  return created;
}

export function getOrCreatePracticeModuleCollectionShareLink(
  collectionId: string,
): StoredPracticeModuleCollectionShareLink {
  const existing = findPracticeModuleCollectionShareLinkForCollection(collectionId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO practice_module_collection_share_links (id, collection_id)
        VALUES (?, ?)
        ON CONFLICT(collection_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, collectionId);

  const created = findPracticeModuleCollectionShareLinkForCollection(collectionId);
  if (!created) {
    throw new Error('Could not load newly created practice module collection share link.');
  }

  return created;
}

export function createConversationPracticeModuleSnapshot(
  conversationId: string,
  practiceModule: StoredPracticeModule,
): StoredConversationPracticeModuleSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_practice_module_snapshots (
          conversation_id,
          practice_module_id,
          title,
          description,
          tutor_instructions
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      practiceModule.id,
      practiceModule.title,
      practiceModule.description,
      practiceModule.tutorInstructions,
    );

  const snapshot = getConversationPracticeModuleSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation practice-module snapshot.');
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

export function getConversationPracticeModuleSnapshot(
  conversationId: string,
): StoredConversationPracticeModuleSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT conversation_id, practice_module_id, title, description, tutor_instructions, created_at
        FROM conversation_practice_module_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationPracticeModuleSnapshotRow | undefined;

  return row ? toStoredConversationPracticeModuleSnapshot(row) : null;
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
