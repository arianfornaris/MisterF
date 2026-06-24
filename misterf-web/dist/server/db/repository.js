import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from './database.js';
const defaultConversationTitle = 'Nueva conversación';
const defaultProfileName = 'Perfil principal';
function toStoredProfile(row) {
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
function toStoredConversation(row) {
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
function parseTutorConversationReportData(reportJson) {
    try {
        const parsed = JSON.parse(reportJson);
        return {
            difficultyAreas: Array.isArray(parsed.difficultyAreas) ? parsed.difficultyAreas : [],
            nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
            practicedTopics: Array.isArray(parsed.practicedTopics) ? parsed.practicedTopics : [],
            progressHighlights: Array.isArray(parsed.progressHighlights) ? parsed.progressHighlights : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            usefulPhrases: Array.isArray(parsed.usefulPhrases) ? parsed.usefulPhrases : [],
            vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
        };
    }
    catch {
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
function toStoredTutorConversationReport(row) {
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
function toStoredConversationChatRoomReportSnapshot(row) {
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
function toStoredConversationTutorReportSnapshot(row) {
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
function parseJsonRecord(value) {
    if (!value) {
        return {};
    }
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
function parseJsonArray(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function isPlainRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function parseAssignmentAuthoringMessages(value) {
    return parseJsonArray(value)
        .flatMap((item) => {
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
function toStoredAssignment(row) {
    return {
        archivedAt: row.archived_at,
        authoringMessages: parseAssignmentAuthoringMessages(row.authoring_messages_json),
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
function toStoredAssignmentShareLink(row) {
    return {
        assignmentId: row.assignment_id,
        createdAt: row.created_at,
        id: row.id,
        revokedAt: row.revoked_at,
    };
}
function toStoredAssignmentAttempt(row) {
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
function toStoredConversationAssignmentAttemptSnapshot(row) {
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
function parseLearnerProgressSummary(summaryJson) {
    const fallback = {
        focusAreas: [],
        overview: '',
        recommendedPractice: [],
        strengths: [],
        updatedFromEvents: 0,
        vocabulary: [],
    };
    try {
        const parsed = JSON.parse(summaryJson);
        return {
            focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas : [],
            overview: typeof parsed.overview === 'string' ? parsed.overview : '',
            recommendedPractice: Array.isArray(parsed.recommendedPractice)
                ? parsed.recommendedPractice
                : [],
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            updatedFromEvents: typeof parsed.updatedFromEvents === 'number' ? parsed.updatedFromEvents : 0,
            vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
        };
    }
    catch {
        return fallback;
    }
}
function parseLearnerProgressEventDetails(detailsJson) {
    const fallback = {
        difficulties: [],
        practiced: [],
        progress: [],
        recommendations: [],
        vocabulary: [],
    };
    try {
        const parsed = JSON.parse(detailsJson);
        return {
            difficulties: Array.isArray(parsed.difficulties) ? parsed.difficulties : [],
            practiced: Array.isArray(parsed.practiced) ? parsed.practiced : [],
            progress: Array.isArray(parsed.progress) ? parsed.progress : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
        };
    }
    catch {
        return fallback;
    }
}
function toStoredLearnerProgressProfile(row) {
    return {
        id: row.id,
        profileId: row.profile_id,
        summary: parseLearnerProgressSummary(row.summary_json),
        userId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toStoredLearnerProgressEvent(row) {
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
function toStoredChatRoom(row) {
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
function toStoredChatRoomShareLink(row) {
    return {
        roomId: row.room_id,
        createdAt: row.created_at,
        id: row.id,
        revokedAt: row.revoked_at,
    };
}
function toStoredChatRoomCharacter(row) {
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
function toStoredChatRoomConversation(row) {
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
function parseChatRoomConversationReportSlides(slidesJson) {
    try {
        const parsed = JSON.parse(slidesJson);
        return Array.isArray(parsed)
            ? parsed
            : [];
    }
    catch {
        return [];
    }
}
function toStoredChatRoomConversationReport(row) {
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
function toStoredChatRoomMessage(row) {
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
function toStoredPracticeModule(row) {
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
function toStoredPracticeModuleCollection(row) {
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
function toStoredPracticeModuleCollectionItem(row) {
    return {
        collectionId: row.collection_id,
        practiceModuleId: row.practice_module_id,
        position: row.position,
        createdAt: row.created_at,
    };
}
function toStoredPracticeModuleShareLink(row) {
    return {
        practiceModuleId: row.practice_module_id,
        createdAt: row.created_at,
        id: row.id,
        revokedAt: row.revoked_at,
    };
}
function toStoredPracticeModuleCollectionShareLink(row) {
    return {
        collectionId: row.collection_id,
        createdAt: row.created_at,
        id: row.id,
        revokedAt: row.revoked_at,
    };
}
function toStoredConversationPracticeModuleSnapshot(row) {
    return {
        practiceModuleId: row.practice_module_id,
        conversationId: row.conversation_id,
        createdAt: row.created_at,
        description: row.description,
        title: row.title,
        tutorInstructions: row.tutor_instructions,
    };
}
function toStoredMessage(row) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        metadata: row.metadata ? parseMetadata(row.metadata) : null,
        createdAt: row.created_at,
    };
}
function toStoredTutorPlan(row) {
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
export function createProfile(input) {
    const id = randomUUID();
    getDb()
        .prepare(`
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
      `)
        .run(id, input.userId, input.name, input.description ?? '', input.learningContext ?? '', input.modelTier ?? 'regular', input.profileOnboardingCompleted === false ? null : new Date().toISOString());
    const profile = findProfileForUser(id, input.userId);
    if (!profile) {
        throw new Error('Could not load newly created profile.');
    }
    return profile;
}
export function findProfileForUser(id, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id, userId);
    return row ? toStoredProfile(row) : null;
}
export function findProfileById(id) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id);
    return row ? toStoredProfile(row) : null;
}
export function listProfilesForUser(userId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(userId);
    return rows.map(toStoredProfile);
}
export function ensureUserHasProfile(userId) {
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
export function updateProfile(input) {
    getDb()
        .prepare(`
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
      `)
        .run(input.name, input.description, input.learningContext ?? null, input.modelTier ?? null, input.profileOnboardingCompleted ? 1 : 0, input.profileId, input.userId);
    return findProfileForUser(input.profileId, input.userId);
}
export function markProfileOnboardingCompleted(input) {
    getDb()
        .prepare(`
        UPDATE profiles
        SET profile_onboarding_completed_at = COALESCE(
              profile_onboarding_completed_at,
              CURRENT_TIMESTAMP
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(input.profileId, input.userId);
    return findProfileForUser(input.profileId, input.userId);
}
export function updateProfileModelTierForUser(profileId, userId, modelTier) {
    getDb()
        .prepare(`
        UPDATE profiles
        SET model_tier = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(modelTier, profileId, userId);
    return findProfileForUser(profileId, userId);
}
export function createConversation(userId, profileId, title = defaultConversationTitle, options = {}) {
    const id = randomUUID();
    const modelTier = options.modelTier ?? findProfileById(profileId)?.modelTier ?? 'regular';
    getDb()
        .prepare(`
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
      `)
        .run(id, userId, profileId, title, options.practiceModuleId ?? null, options.chatRoomConversationReportId ?? null, 'tutor', modelTier);
    const conversation = findConversationForUser(id, userId);
    if (!conversation) {
        throw new Error('Could not load newly created conversation.');
    }
    return conversation;
}
export function createConversationFromPracticeModule(userId, practiceModule) {
    const conversation = createConversation(userId, practiceModule.profileId, defaultConversationTitle, {
        practiceModuleId: practiceModule.id,
    });
    createConversationPracticeModuleSnapshot(conversation.id, practiceModule);
    return conversation;
}
export function createConversationFromChatRoomReport(input) {
    const conversation = createConversation(input.userId, input.profileId, defaultConversationTitle, {
        chatRoomConversationReportId: input.report.id,
    });
    createConversationChatRoomReportSnapshot(conversation.id, {
        report: input.report,
        room: input.room,
    });
    return conversation;
}
export function createConversationFromTutorReport(input) {
    const conversation = createConversation(input.userId, input.profileId, defaultConversationTitle);
    createConversationTutorReportSnapshot(conversation.id, input.report);
    return conversation;
}
export function findConversationForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_module_id, profile_id, active_agent
             , model_tier, chat_room_conversation_report_id
        FROM conversations
        WHERE id = ? AND user_id = ?
      `)
        .get(id, userId);
    return row ? toStoredConversation(row) : null;
}
export function getOrCreateConversation(userId, profileId, id) {
    if (id) {
        const existing = findConversationForUser(id, userId);
        if (existing) {
            return existing;
        }
    }
    return createConversation(userId, profileId);
}
export function touchConversation(conversationId) {
    getDb()
        .prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(conversationId);
}
export function closeConversationForUser(conversationId, userId) {
    getDb()
        .prepare(`
        UPDATE conversations
        SET closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(conversationId, userId);
    return findConversationForUser(conversationId, userId);
}
export function listConversationsForProfile(userId, profileId) {
    const rows = getDb()
        .prepare(`
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_module_id, profile_id, active_agent
             , model_tier, chat_room_conversation_report_id
        FROM conversations
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)
        .all(userId, profileId);
    return rows.map(toStoredConversation);
}
export function renameConversationForUser(id, userId, title, options = {}) {
    getDb()
        .prepare(`
        UPDATE conversations
        SET title = ?,
            title_updated_by_user = CASE
              WHEN ? THEN 1
              ELSE title_updated_by_user
            END
        WHERE id = ? AND user_id = ?
      `)
        .run(title, options.updatedByUser ? 1 : 0, id, userId);
    return findConversationForUser(id, userId);
}
export function updateConversationModelTierForUser(id, userId, modelTier) {
    getDb()
        .prepare(`
        UPDATE conversations
        SET model_tier = ?
        WHERE id = ? AND user_id = ?
      `)
        .run(modelTier, id, userId);
    return findConversationForUser(id, userId);
}
export function updateConversationModelTierForProfile(userId, profileId, modelTier) {
    getDb()
        .prepare(`
        UPDATE conversations
        SET model_tier = ?
        WHERE user_id = ? AND profile_id = ?
      `)
        .run(modelTier, userId, profileId);
}
export function deleteConversationForUser(id, userId) {
    const result = getDb()
        .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
        .run(id, userId);
    return result.changes > 0;
}
export function createChatRoom(input) {
    const db = getDb();
    const roomId = randomUUID();
    const insertRoom = db.prepare(`
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
    `);
    const insertCharacter = db.prepare(`
      INSERT INTO chat_room_characters (
        id,
        room_id,
        name,
        short_description,
        full_description,
        position
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        insertRoom.run(roomId, input.userId, input.profileId, input.title, input.description, input.sourceRoomId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
        input.characters.forEach((character, index) => {
            insertCharacter.run(randomUUID(), roomId, character.name, character.shortDescription ?? '', character.fullDescription, index);
        });
    })();
    const room = findChatRoomForUser(roomId, input.userId);
    if (!room) {
        throw new Error('Could not load newly created chat room.');
    }
    return room;
}
export function findChatRoomForUser(id, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id, userId);
    return row ? toStoredChatRoom(row) : null;
}
export function findChatRoomById(id) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id);
    return row ? toStoredChatRoom(row) : null;
}
export function listChatRoomsForProfile(userId, profileId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(userId, profileId);
    return rows.map(toStoredChatRoom);
}
export function deleteChatRoomForUser(roomId, userId) {
    const result = getDb()
        .prepare('DELETE FROM chat_rooms WHERE id = ? AND user_id = ?')
        .run(roomId, userId);
    return result.changes > 0;
}
export function updateChatRoomForUser(input) {
    const db = getDb();
    const room = findChatRoomForUser(input.roomId, input.userId);
    if (!room) {
        return null;
    }
    const updateRoom = db.prepare(`
      UPDATE chat_rooms
      SET title = ?,
          description = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);
    const deleteCharacters = db.prepare('DELETE FROM chat_room_characters WHERE room_id = ?');
    const insertCharacter = db.prepare(`
      INSERT INTO chat_room_characters (
        id,
        room_id,
        name,
        short_description,
        full_description,
        position
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        updateRoom.run(input.title, input.description, input.roomId, input.userId);
        deleteCharacters.run(input.roomId);
        input.characters.forEach((character, index) => {
            insertCharacter.run(randomUUID(), input.roomId, character.name, character.shortDescription ?? '', character.fullDescription, index);
        });
    })();
    return findChatRoomForUser(input.roomId, input.userId);
}
export function archiveChatRoomForUser(roomId, userId) {
    const room = findChatRoomForUser(roomId, userId);
    if (!room) {
        return null;
    }
    getDb()
        .prepare(`
        UPDATE chat_rooms
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(roomId, userId);
    return findChatRoomForUser(roomId, userId);
}
export function restoreChatRoomForUser(roomId, userId) {
    const room = findChatRoomForUser(roomId, userId);
    if (!room) {
        return null;
    }
    getDb()
        .prepare(`
        UPDATE chat_rooms
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(roomId, userId);
    return findChatRoomForUser(roomId, userId);
}
export function findImportedChatRoomForProfile(input) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(input.userId, input.profileId, input.sourceRoomId);
    return row ? toStoredChatRoom(row) : null;
}
export function importChatRoomToProfile(input) {
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
export function listChatRoomCharacters(roomId) {
    const rows = getDb()
        .prepare(`
        SELECT id, room_id, name, short_description, full_description, position, created_at, updated_at
        FROM chat_room_characters
        WHERE room_id = ?
        ORDER BY position ASC, created_at ASC
      `)
        .all(roomId);
    return rows.map(toStoredChatRoomCharacter);
}
export function findChatRoomShareLinkById(id) {
    const row = getDb()
        .prepare(`
        SELECT id, room_id, created_at, revoked_at
        FROM chat_room_share_links
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredChatRoomShareLink(row) : null;
}
export function findChatRoomShareLinkForRoom(roomId) {
    const row = getDb()
        .prepare(`
        SELECT id, room_id, created_at, revoked_at
        FROM chat_room_share_links
        WHERE room_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `)
        .get(roomId);
    return row ? toStoredChatRoomShareLink(row) : null;
}
export function getOrCreateChatRoomShareLink(roomId) {
    const existing = findChatRoomShareLinkForRoom(roomId);
    if (existing) {
        return existing;
    }
    const id = randomBytes(18).toString('base64url');
    getDb()
        .prepare(`
        INSERT INTO chat_room_share_links (id, room_id)
        VALUES (?, ?)
        ON CONFLICT(room_id) DO UPDATE SET
          revoked_at = NULL
      `)
        .run(id, roomId);
    const created = findChatRoomShareLinkForRoom(roomId);
    if (!created) {
        throw new Error('Could not load newly created chat room share link.');
    }
    return created;
}
export function createChatRoomConversation(userId, room, title = room.title) {
    const id = randomUUID();
    getDb()
        .prepare(`
        INSERT INTO chat_room_conversations (id, room_id, user_id, profile_id, title)
        VALUES (?, ?, ?, ?, ?)
      `)
        .run(id, room.id, userId, room.profileId, title);
    const conversation = findChatRoomConversationForUser(id, userId);
    if (!conversation) {
        throw new Error('Could not load newly created chat room conversation.');
    }
    return conversation;
}
export function findChatRoomConversationForUser(id, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id, userId);
    return row ? toStoredChatRoomConversation(row) : null;
}
export function listChatRoomConversationsForRoom(roomId, userId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(roomId, userId);
    return rows.map(toStoredChatRoomConversation);
}
export function findLatestChatRoomConversationForRoom(roomId, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(roomId, userId);
    return row ? toStoredChatRoomConversation(row) : null;
}
export function touchChatRoomConversation(conversationId) {
    getDb()
        .prepare('UPDATE chat_room_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(conversationId);
}
export function findChatRoomConversationReport(conversationId, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId, userId);
    return row ? toStoredChatRoomConversationReport(row) : null;
}
export function saveChatRoomConversationReport(input) {
    const existing = findChatRoomConversationReport(input.conversationId, input.userId);
    if (existing) {
        getDb()
            .prepare(`
          UPDATE chat_room_conversation_reports
          SET summary_title = ?,
              summary_description = ?,
              slides_json = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
            .run(input.summaryTitle, input.summaryDescription, JSON.stringify(input.slides), existing.id);
        const updated = findChatRoomConversationReport(input.conversationId, input.userId);
        if (!updated) {
            throw new Error('Could not load updated chat room conversation report.');
        }
        touchChatRoomConversation(input.conversationId);
        return updated;
    }
    const id = randomUUID();
    getDb()
        .prepare(`
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
      `)
        .run(id, input.conversationId, input.roomId, input.userId, input.profileId, input.summaryTitle, input.summaryDescription, JSON.stringify(input.slides));
    const created = findChatRoomConversationReport(input.conversationId, input.userId);
    if (!created) {
        throw new Error('Could not load newly created chat room conversation report.');
    }
    touchChatRoomConversation(input.conversationId);
    return created;
}
export function setChatRoomConversationReportPracticeModule(input) {
    getDb()
        .prepare(`
        UPDATE chat_room_conversation_reports
        SET practice_module_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `)
        .run(input.practiceModuleId, input.conversationId, input.userId);
    touchChatRoomConversation(input.conversationId);
    return findChatRoomConversationReport(input.conversationId, input.userId);
}
export function findTutorConversationReport(conversationId, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId, userId);
    return row ? toStoredTutorConversationReport(row) : null;
}
export function saveTutorConversationReport(input) {
    const existing = findTutorConversationReport(input.conversationId, input.userId);
    if (existing) {
        getDb()
            .prepare(`
          UPDATE tutor_conversation_reports
          SET summary_title = ?,
              summary_description = ?,
              report_json = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
            .run(input.summaryTitle, input.summaryDescription, JSON.stringify(input.report), existing.id);
        const updated = findTutorConversationReport(input.conversationId, input.userId);
        if (!updated) {
            throw new Error('Could not load updated tutor conversation report.');
        }
        touchConversation(input.conversationId);
        return updated;
    }
    const id = randomUUID();
    getDb()
        .prepare(`
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
      `)
        .run(id, input.conversationId, input.userId, input.profileId, input.summaryTitle, input.summaryDescription, JSON.stringify(input.report));
    const created = findTutorConversationReport(input.conversationId, input.userId);
    if (!created) {
        throw new Error('Could not load newly created tutor conversation report.');
    }
    touchConversation(input.conversationId);
    return created;
}
export function setTutorConversationReportPracticeModule(input) {
    getDb()
        .prepare(`
        UPDATE tutor_conversation_reports
        SET practice_module_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `)
        .run(input.practiceModuleId, input.conversationId, input.userId);
    touchConversation(input.conversationId);
    return findTutorConversationReport(input.conversationId, input.userId);
}
export function findLearnerProgressProfile(userId, profileId) {
    const row = getDb()
        .prepare(`
        SELECT
          id,
          user_id,
          profile_id,
          summary_json,
          created_at,
          updated_at
        FROM learner_progress_profiles
        WHERE user_id = ? AND profile_id = ?
      `)
        .get(userId, profileId);
    return row ? toStoredLearnerProgressProfile(row) : null;
}
export function upsertLearnerProgressProfile(input) {
    const id = randomUUID();
    getDb()
        .prepare(`
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
      `)
        .run(id, input.userId, input.profileId, JSON.stringify(input.summary));
    const profile = findLearnerProgressProfile(input.userId, input.profileId);
    if (!profile) {
        throw new Error('Could not load learner progress profile.');
    }
    return profile;
}
export function listLearnerProgressEvents(input) {
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
    const rows = getDb()
        .prepare(`
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
      `)
        .all(input.userId, input.profileId, limit);
    return rows.map(toStoredLearnerProgressEvent);
}
export function upsertLearnerProgressEvent(input) {
    getDb()
        .prepare(`
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
      `)
        .run(input.userId, input.profileId, input.sourceType, input.sourceId, input.eventDate ?? null, input.title, input.summary, JSON.stringify(input.details));
    const row = getDb()
        .prepare(`
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
      `)
        .get(input.userId, input.profileId, input.sourceType, input.sourceId);
    if (!row) {
        throw new Error('Could not load learner progress event.');
    }
    return toStoredLearnerProgressEvent(row);
}
export function createAssignment(input) {
    const id = randomUUID();
    getDb()
        .prepare(`
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
          authoring_messages_json,
          source_assignment_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(id, input.userId, input.profileId, input.title, input.description ?? '', input.targetTopic ?? '', input.level ?? '', input.instructions ?? '', JSON.stringify(input.quiz), JSON.stringify(input.authoringMessages ?? []), input.sourceAssignmentId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
    const assignment = findAssignmentForUser(id, input.userId);
    if (!assignment) {
        throw new Error('Could not load newly created assignment.');
    }
    return assignment;
}
export function findAssignmentForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT
          archived_at,
          authoring_messages_json,
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
      `)
        .get(id, userId);
    return row ? toStoredAssignment(row) : null;
}
export function findAssignmentById(id) {
    const row = getDb()
        .prepare(`
        SELECT
          archived_at,
          authoring_messages_json,
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
      `)
        .get(id);
    return row ? toStoredAssignment(row) : null;
}
export function listAssignmentsForProfile(input) {
    const rows = getDb()
        .prepare(`
        SELECT
          archived_at,
          authoring_messages_json,
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
      `)
        .all(input.userId, input.profileId, input.includeArchived ? 1 : 0);
    return rows.map(toStoredAssignment);
}
export function updateAssignment(input) {
    getDb()
        .prepare(`
        UPDATE assignments
        SET title = ?,
            description = ?,
            target_topic = ?,
            level = ?,
            instructions = ?,
            quiz_json = ?,
            authoring_messages_json = COALESCE(?, authoring_messages_json),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(input.title, input.description, input.targetTopic, input.level, input.instructions, JSON.stringify(input.quiz), input.authoringMessages === undefined
        ? null
        : JSON.stringify(input.authoringMessages), input.assignmentId, input.userId);
    return findAssignmentForUser(input.assignmentId, input.userId);
}
export function updateAssignmentAuthoringMessages(input) {
    getDb()
        .prepare(`
        UPDATE assignments
        SET authoring_messages_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(JSON.stringify(input.messages), input.assignmentId, input.userId);
    return findAssignmentForUser(input.assignmentId, input.userId);
}
export function findImportedAssignmentForProfile(input) {
    const row = getDb()
        .prepare(`
        SELECT
          archived_at,
          authoring_messages_json,
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
      `)
        .get(input.userId, input.profileId, input.sourceAssignmentId);
    return row ? toStoredAssignment(row) : null;
}
export function importAssignmentToProfile(input) {
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
export function setAssignmentFavoriteForUser(assignmentId, userId, isFavorite) {
    getDb()
        .prepare(`
        UPDATE assignments
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(isFavorite ? 1 : 0, assignmentId, userId);
    return findAssignmentForUser(assignmentId, userId);
}
export function archiveAssignmentForUser(assignmentId, userId) {
    getDb()
        .prepare(`
        UPDATE assignments
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(assignmentId, userId);
    return findAssignmentForUser(assignmentId, userId);
}
export function restoreAssignmentForUser(assignmentId, userId) {
    getDb()
        .prepare(`
        UPDATE assignments
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(assignmentId, userId);
    return findAssignmentForUser(assignmentId, userId);
}
export function findAssignmentShareLinkById(id) {
    const row = getDb()
        .prepare(`
        SELECT id, assignment_id, created_at, revoked_at
        FROM assignment_share_links
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredAssignmentShareLink(row) : null;
}
export function findAssignmentShareLinkForAssignment(assignmentId) {
    const row = getDb()
        .prepare(`
        SELECT id, assignment_id, created_at, revoked_at
        FROM assignment_share_links
        WHERE assignment_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `)
        .get(assignmentId);
    return row ? toStoredAssignmentShareLink(row) : null;
}
export function getOrCreateAssignmentShareLink(assignmentId) {
    const existing = findAssignmentShareLinkForAssignment(assignmentId);
    if (existing) {
        return existing;
    }
    const id = randomBytes(18).toString('base64url');
    getDb()
        .prepare(`
        INSERT INTO assignment_share_links (id, assignment_id)
        VALUES (?, ?)
        ON CONFLICT(assignment_id) DO UPDATE SET
          revoked_at = NULL
      `)
        .run(id, assignmentId);
    const created = findAssignmentShareLinkForAssignment(assignmentId);
    if (!created) {
        throw new Error('Could not load newly created assignment share link.');
    }
    return created;
}
export function createAssignmentAttempt(input) {
    const id = randomUUID();
    const isGuest = !input.userId;
    const guestToken = isGuest ? randomBytes(24).toString('base64url') : null;
    const claimToken = isGuest ? randomBytes(24).toString('base64url') : null;
    getDb()
        .prepare(`
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
      `)
        .run(id, input.assignmentId, input.userId ?? null, input.profileId ?? null, guestToken, claimToken, input.isPreview ? 1 : 0, JSON.stringify(input.snapshot));
    const attempt = findAssignmentAttemptById(id);
    if (!attempt) {
        throw new Error('Could not load newly created assignment attempt.');
    }
    return attempt;
}
export function findAssignmentAttemptById(id) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id);
    return row ? toStoredAssignmentAttempt(row) : null;
}
export function findAssignmentAttemptForUser(id, userId) {
    const attempt = findAssignmentAttemptById(id);
    return attempt?.userId === userId ? attempt : null;
}
export function findAssignmentAttemptByGuestToken(guestToken) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(guestToken);
    return row ? toStoredAssignmentAttempt(row) : null;
}
export function findAssignmentAttemptByClaimToken(claimToken) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(claimToken);
    return row ? toStoredAssignmentAttempt(row) : null;
}
export function listAssignmentAttemptsForUser(input) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(input.userId, input.profileId, input.assignmentId ?? null, input.assignmentId ?? null, input.includePreview ? 1 : 0);
    return rows.map(toStoredAssignmentAttempt);
}
export function submitAssignmentAttempt(input) {
    getDb()
        .prepare(`
        UPDATE assignment_attempts
        SET responses_json = ?,
            status = 'submitted',
            submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('draft', 'failed')
      `)
        .run(JSON.stringify(input.responses), input.attemptId);
    return findAssignmentAttemptById(input.attemptId);
}
export function markAssignmentAttemptEvaluating(attemptId) {
    getDb()
        .prepare(`
        UPDATE assignment_attempts
        SET status = 'evaluating',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(attemptId);
    return findAssignmentAttemptById(attemptId);
}
export function saveAssignmentAttemptResult(input) {
    getDb()
        .prepare(`
        UPDATE assignment_attempts
        SET result_json = ?,
            status = 'evaluated',
            evaluated_at = COALESCE(evaluated_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(JSON.stringify(input.result), input.attemptId);
    return findAssignmentAttemptById(input.attemptId);
}
export function markAssignmentAttemptFailed(attemptId) {
    getDb()
        .prepare(`
        UPDATE assignment_attempts
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(attemptId);
    return findAssignmentAttemptById(attemptId);
}
export function attachAssignmentAttemptToUser(input) {
    getDb()
        .prepare(`
        UPDATE assignment_attempts
        SET user_id = ?,
            profile_id = ?,
            claim_token = NULL,
            guest_token = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND claim_token = ?
          AND user_id IS NULL
      `)
        .run(input.userId, input.profileId, input.attemptId, input.claimToken);
    return findAssignmentAttemptById(input.attemptId);
}
export function setAssignmentAttemptProgressEvent(input) {
    getDb()
        .prepare(`
        UPDATE assignment_attempts
        SET progress_event_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(input.progressEventId, input.attemptId);
    return findAssignmentAttemptById(input.attemptId);
}
export function createConversationFromAssignmentAttempt(input) {
    const title = readStringFromRecord(input.attempt.snapshot, 'title') || defaultConversationTitle;
    const conversation = createConversation(input.userId, input.profileId, `Practicar: ${title}`);
    createConversationAssignmentAttemptSnapshot(conversation.id, input.attempt);
    return conversation;
}
export function createConversationAssignmentAttemptSnapshot(conversationId, attempt) {
    getDb()
        .prepare(`
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
      `)
        .run(conversationId, attempt.id, readStringFromRecord(attempt.snapshot, 'title'), readStringFromRecord(attempt.snapshot, 'description'), readStringFromRecord(attempt.snapshot, 'targetTopic'), JSON.stringify(attempt.snapshot), JSON.stringify(attempt.responses), JSON.stringify(attempt.result ?? {}));
    const snapshot = getConversationAssignmentAttemptSnapshot(conversationId);
    if (!snapshot) {
        throw new Error('Could not load conversation assignment-attempt snapshot.');
    }
    return snapshot;
}
export function getConversationAssignmentAttemptSnapshot(conversationId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId);
    return row ? toStoredConversationAssignmentAttemptSnapshot(row) : null;
}
function readStringFromRecord(record, key) {
    const value = record[key];
    return typeof value === 'string' ? value : '';
}
export function createPracticeModule(input) {
    const id = randomUUID();
    getDb()
        .prepare(`
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
      `)
        .run(id, input.userId, input.profileId, input.title, input.description, input.tutorInstructions, input.collectionId ?? null, input.positionInCollection ?? null, input.sourcePracticeModuleId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
    const practiceModule = findPracticeModuleForUser(id, input.userId);
    if (!practiceModule) {
        throw new Error('Could not load newly created practice module.');
    }
    return practiceModule;
}
export function findPracticeModuleForUser(id, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id, userId);
    return row ? toStoredPracticeModule(row) : null;
}
export function findPracticeModuleById(id) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id);
    return row ? toStoredPracticeModule(row) : null;
}
export function listPracticeModulesForProfile(userId, profileId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(userId, profileId);
    return rows.map(toStoredPracticeModule);
}
export function createPracticeModuleCollection(input) {
    const id = randomUUID();
    getDb()
        .prepare(`
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
      `)
        .run(id, input.userId, input.profileId, input.title, input.description, input.sourceCollectionId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
    const collection = findPracticeModuleCollectionForUser(id, input.userId);
    if (!collection) {
        throw new Error('Could not load newly created practice module collection.');
    }
    return collection;
}
export function findPracticeModuleCollectionForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE id = ? AND user_id = ?
      `)
        .get(id, userId);
    return row ? toStoredPracticeModuleCollection(row) : null;
}
export function findPracticeModuleCollectionById(id) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredPracticeModuleCollection(row) : null;
}
export function listPracticeModuleCollectionsForProfile(userId, profileId) {
    const rows = getDb()
        .prepare(`
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)
        .all(userId, profileId);
    return rows.map(toStoredPracticeModuleCollection);
}
export function updatePracticeModuleCollection(input) {
    getDb()
        .prepare(`
        UPDATE practice_module_collections
        SET title = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(input.title, input.description, input.collectionId, input.userId);
    return findPracticeModuleCollectionForUser(input.collectionId, input.userId);
}
export function findImportedPracticeModuleCollectionForProfile(input) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE user_id = ?
          AND profile_id = ?
          AND source_collection_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `)
        .get(input.userId, input.profileId, input.sourceCollectionId);
    return row ? toStoredPracticeModuleCollection(row) : null;
}
export function setPracticeModuleCollectionFavoriteForUser(collectionId, userId, isFavorite) {
    const result = getDb()
        .prepare(`
        UPDATE practice_module_collections
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(isFavorite ? 1 : 0, collectionId, userId);
    if (result.changes < 1) {
        return null;
    }
    return findPracticeModuleCollectionForUser(collectionId, userId);
}
export function archivePracticeModuleCollectionForUser(collectionId, userId) {
    const collection = findPracticeModuleCollectionForUser(collectionId, userId);
    if (!collection) {
        return null;
    }
    const db = getDb();
    const transaction = db.transaction(() => {
        db.prepare(`
        UPDATE practice_module_collections
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(collectionId, userId);
        db.prepare(`
        UPDATE practice_modules
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND collection_id = ?
      `).run(userId, collectionId);
    });
    transaction();
    return findPracticeModuleCollectionForUser(collectionId, userId);
}
export function restorePracticeModuleCollectionForUser(collectionId, userId) {
    const collection = findPracticeModuleCollectionForUser(collectionId, userId);
    if (!collection) {
        return null;
    }
    const db = getDb();
    const transaction = db.transaction(() => {
        db.prepare(`
        UPDATE practice_module_collections
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(collectionId, userId);
        db.prepare(`
        UPDATE practice_modules
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND collection_id = ?
      `).run(userId, collectionId);
    });
    transaction();
    return findPracticeModuleCollectionForUser(collectionId, userId);
}
export function listPracticeModuleCollectionItems(collectionId, userId) {
    const rows = getDb()
        .prepare(`
        SELECT
          collection_id,
          id AS practice_module_id,
          COALESCE(position_in_collection, 0) AS position,
          created_at
        FROM practice_modules
        WHERE collection_id = ?
          AND user_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `)
        .all(collectionId, userId);
    return rows.map(toStoredPracticeModuleCollectionItem);
}
export function listPracticeModulesForCollection(collectionId, userId) {
    return listPracticeModuleCollectionItems(collectionId, userId)
        .map((item) => {
        const practiceModule = findPracticeModuleForUser(item.practiceModuleId, userId);
        return practiceModule ? { ...item, practiceModule } : null;
    })
        .filter((entry) => Boolean(entry));
}
function listPracticeModulesByCollectionId(collectionId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(collectionId);
    return rows.map(toStoredPracticeModule);
}
function normalizePracticeModuleCollectionPositions(collectionId) {
    const db = getDb();
    const rows = db
        .prepare(`
        SELECT
          collection_id,
          id AS practice_module_id,
          COALESCE(position_in_collection, 0) AS position,
          created_at
        FROM practice_modules
        WHERE collection_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `)
        .all(collectionId);
    const update = db.prepare(`
      UPDATE practice_modules
      SET position_in_collection = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE collection_id = ? AND id = ?
    `);
    rows.forEach((row, index) => {
        update.run(index + 1, row.collection_id, row.practice_module_id);
    });
}
export function listPracticeModuleCollectionsContainingModule(practiceModuleId, userId) {
    const practiceModule = findPracticeModuleForUser(practiceModuleId, userId);
    if (!practiceModule?.collectionId) {
        return [];
    }
    const collection = findPracticeModuleCollectionForUser(practiceModule.collectionId, userId);
    return collection ? [collection] : [];
}
export function addPracticeModuleToCollection(input) {
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
        .prepare(`
        SELECT COALESCE(MAX(position), 0) AS max_position
        FROM practice_modules
        WHERE collection_id = ?
      `)
        .get(input.collectionId);
    const previousCollectionId = practiceModule.collectionId;
    db.prepare(`
      UPDATE practice_modules
      SET collection_id = ?,
          position_in_collection = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(input.collectionId, nextPositionRow.max_position + 1, input.practiceModuleId, input.userId);
    if (previousCollectionId) {
        normalizePracticeModuleCollectionPositions(previousCollectionId);
    }
    db.prepare(`
      UPDATE practice_module_collections
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id IN (?, ?)
    `).run(input.collectionId, previousCollectionId ?? input.collectionId);
    return true;
}
export function removePracticeModuleFromCollection(input) {
    const collection = findPracticeModuleCollectionForUser(input.collectionId, input.userId);
    if (!collection) {
        return false;
    }
    const db = getDb();
    const result = db.prepare(`
      UPDATE practice_modules
      SET collection_id = NULL,
          position_in_collection = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE collection_id = ? AND id = ? AND user_id = ?
    `).run(input.collectionId, input.practiceModuleId, input.userId);
    if (result.changes < 1) {
        return false;
    }
    normalizePracticeModuleCollectionPositions(input.collectionId);
    db.prepare(`
      UPDATE practice_module_collections
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(input.collectionId);
    return true;
}
export function movePracticeModuleCollectionItem(input) {
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
        db.prepare(`
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `).run(-1, input.collectionId, current.practiceModuleId);
        db.prepare(`
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `).run(current.position, input.collectionId, other.practiceModuleId);
        db.prepare(`
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `).run(other.position, input.collectionId, current.practiceModuleId);
        db.prepare(`
        UPDATE practice_module_collections
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(input.collectionId);
    });
    transaction();
    return true;
}
export function deletePracticeModuleForUser(id, userId) {
    const result = getDb()
        .prepare('DELETE FROM practice_modules WHERE id = ? AND user_id = ?')
        .run(id, userId);
    return result.changes > 0;
}
export function setPracticeModuleFavoriteForUser(practiceModuleId, userId, isFavorite) {
    const result = getDb()
        .prepare(`
        UPDATE practice_modules
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(isFavorite ? 1 : 0, practiceModuleId, userId);
    if (result.changes < 1) {
        return null;
    }
    return findPracticeModuleForUser(practiceModuleId, userId);
}
export function archivePracticeModuleForUser(practiceModuleId, userId) {
    const result = getDb()
        .prepare(`
        UPDATE practice_modules
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(practiceModuleId, userId);
    if (result.changes < 1) {
        return null;
    }
    return findPracticeModuleForUser(practiceModuleId, userId);
}
export function restorePracticeModuleForUser(practiceModuleId, userId) {
    const result = getDb()
        .prepare(`
        UPDATE practice_modules
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(practiceModuleId, userId);
    if (result.changes < 1) {
        return null;
    }
    return findPracticeModuleForUser(practiceModuleId, userId);
}
export function listConversationsForPracticeModule(practiceModuleId, userId, profileId) {
    const rows = getDb()
        .prepare(`
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_module_id, profile_id, active_agent, model_tier, chat_room_conversation_report_id
        FROM conversations
        WHERE user_id = ? AND profile_id = ? AND practice_module_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)
        .all(userId, profileId, practiceModuleId);
    return rows.map(toStoredConversation);
}
export function updatePracticeModule(input) {
    getDb()
        .prepare(`
        UPDATE practice_modules
        SET title = ?,
            description = ?,
            tutor_instructions = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(input.title, input.description, input.tutorInstructions, input.practiceModuleId, input.userId);
    return findPracticeModuleForUser(input.practiceModuleId, input.userId);
}
export function findImportedPracticeModuleForProfile(input) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(input.userId, input.profileId, input.sourcePracticeModuleId);
    return row ? toStoredPracticeModule(row) : null;
}
export function importPracticeModuleToProfile(input) {
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
export function importPracticeModuleCollectionToProfile(input) {
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
export function findPracticeModuleShareLinkById(id) {
    const row = getDb()
        .prepare(`
        SELECT id, practice_module_id, created_at, revoked_at
        FROM practice_module_share_links
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredPracticeModuleShareLink(row) : null;
}
export function findPracticeModuleCollectionShareLinkById(id) {
    const row = getDb()
        .prepare(`
        SELECT id, collection_id, created_at, revoked_at
        FROM practice_module_collection_share_links
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredPracticeModuleCollectionShareLink(row) : null;
}
export function findPracticeModuleShareLinkForPracticeModule(practiceModuleId) {
    const row = getDb()
        .prepare(`
        SELECT id, practice_module_id, created_at, revoked_at
        FROM practice_module_share_links
        WHERE practice_module_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `)
        .get(practiceModuleId);
    return row ? toStoredPracticeModuleShareLink(row) : null;
}
export function findPracticeModuleCollectionShareLinkForCollection(collectionId) {
    const row = getDb()
        .prepare(`
        SELECT id, collection_id, created_at, revoked_at
        FROM practice_module_collection_share_links
        WHERE collection_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `)
        .get(collectionId);
    return row ? toStoredPracticeModuleCollectionShareLink(row) : null;
}
export function getOrCreatePracticeModuleShareLink(practiceModuleId) {
    const existing = findPracticeModuleShareLinkForPracticeModule(practiceModuleId);
    if (existing) {
        return existing;
    }
    const id = randomBytes(18).toString('base64url');
    getDb()
        .prepare(`
        INSERT INTO practice_module_share_links (id, practice_module_id)
        VALUES (?, ?)
        ON CONFLICT(practice_module_id) DO UPDATE SET
          revoked_at = NULL
      `)
        .run(id, practiceModuleId);
    const created = findPracticeModuleShareLinkForPracticeModule(practiceModuleId);
    if (!created) {
        throw new Error('Could not load newly created practice-module share link.');
    }
    return created;
}
export function getOrCreatePracticeModuleCollectionShareLink(collectionId) {
    const existing = findPracticeModuleCollectionShareLinkForCollection(collectionId);
    if (existing) {
        return existing;
    }
    const id = randomBytes(18).toString('base64url');
    getDb()
        .prepare(`
        INSERT INTO practice_module_collection_share_links (id, collection_id)
        VALUES (?, ?)
        ON CONFLICT(collection_id) DO UPDATE SET
          revoked_at = NULL
      `)
        .run(id, collectionId);
    const created = findPracticeModuleCollectionShareLinkForCollection(collectionId);
    if (!created) {
        throw new Error('Could not load newly created practice module collection share link.');
    }
    return created;
}
export function createConversationPracticeModuleSnapshot(conversationId, practiceModule) {
    getDb()
        .prepare(`
        INSERT OR REPLACE INTO conversation_practice_module_snapshots (
          conversation_id,
          practice_module_id,
          title,
          description,
          tutor_instructions
        )
        VALUES (?, ?, ?, ?, ?)
      `)
        .run(conversationId, practiceModule.id, practiceModule.title, practiceModule.description, practiceModule.tutorInstructions);
    const snapshot = getConversationPracticeModuleSnapshot(conversationId);
    if (!snapshot) {
        throw new Error('Could not load conversation practice-module snapshot.');
    }
    return snapshot;
}
export function createConversationChatRoomReportSnapshot(conversationId, input) {
    getDb()
        .prepare(`
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
      `)
        .run(conversationId, input.report.id, input.report.conversationId, input.room.title, input.room.description, input.report.summaryTitle, input.report.summaryDescription, JSON.stringify(input.report.slides));
    const snapshot = getConversationChatRoomReportSnapshot(conversationId);
    if (!snapshot) {
        throw new Error('Could not load conversation chat-room-report snapshot.');
    }
    return snapshot;
}
export function createConversationTutorReportSnapshot(conversationId, report) {
    getDb()
        .prepare(`
        INSERT OR REPLACE INTO conversation_tutor_report_snapshots (
          conversation_id,
          tutor_conversation_report_id,
          source_conversation_id,
          report_summary_title,
          report_summary_description,
          report_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
        .run(conversationId, report.id, report.conversationId, report.summaryTitle, report.summaryDescription, JSON.stringify(report.report));
    const snapshot = getConversationTutorReportSnapshot(conversationId);
    if (!snapshot) {
        throw new Error('Could not load conversation tutor-report snapshot.');
    }
    return snapshot;
}
export function getConversationPracticeModuleSnapshot(conversationId) {
    const row = getDb()
        .prepare(`
        SELECT conversation_id, practice_module_id, title, description, tutor_instructions, created_at
        FROM conversation_practice_module_snapshots
        WHERE conversation_id = ?
      `)
        .get(conversationId);
    return row ? toStoredConversationPracticeModuleSnapshot(row) : null;
}
export function getConversationChatRoomReportSnapshot(conversationId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId);
    return row ? toStoredConversationChatRoomReportSnapshot(row) : null;
}
export function getConversationTutorReportSnapshot(conversationId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId);
    return row ? toStoredConversationTutorReportSnapshot(row) : null;
}
export function listMessages(conversationId) {
    const rows = getDb()
        .prepare(`
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `)
        .all(conversationId);
    return rows.map(toStoredMessage);
}
export function addMessage(conversationId, role, content, metadata = null) {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO messages (conversation_id, role, content, metadata)
      VALUES (?, ?, ?, ?)
    `);
    const result = insert.run(conversationId, role, content, metadata ? JSON.stringify(metadata) : null);
    touchConversation(conversationId);
    const row = db
        .prepare(`
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ?
      `)
        .get(result.lastInsertRowid);
    return toStoredMessage(row);
}
export function findMessageInConversation(messageId, conversationId) {
    const row = getDb()
        .prepare(`
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `)
        .get(messageId, conversationId);
    return row ? toStoredMessage(row) : null;
}
export function updateMessageMetadata(messageId, conversationId, metadataPatch) {
    const db = getDb();
    const existing = db
        .prepare(`
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `)
        .get(messageId, conversationId);
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
    db.prepare(`
      UPDATE messages
      SET metadata = ?
      WHERE id = ? AND conversation_id = ?
    `).run(JSON.stringify(nextMetadata), messageId, conversationId);
    const updated = db
        .prepare(`
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `)
        .get(messageId, conversationId);
    return updated ? toStoredMessage(updated) : null;
}
export function getConversationTutorPlan(conversationId) {
    const row = getDb()
        .prepare(`
        SELECT conversation_id, plan_json, created_at, updated_at
        FROM conversation_tutor_plans
        WHERE conversation_id = ?
      `)
        .get(conversationId);
    return row ? toStoredTutorPlan(row) : null;
}
export function saveConversationTutorPlan(input) {
    const planJson = JSON.stringify({
        steps: input.plan.steps,
        summary: input.plan.summary,
        title: input.plan.title,
    });
    getDb()
        .prepare(`
        INSERT INTO conversation_tutor_plans (conversation_id, plan_json)
        VALUES (?, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET
          plan_json = excluded.plan_json,
          updated_at = CURRENT_TIMESTAMP
      `)
        .run(input.conversationId, planJson);
    touchConversation(input.conversationId);
    const plan = getConversationTutorPlan(input.conversationId);
    if (!plan) {
        throw new Error('Tutor plan was not saved.');
    }
    return plan;
}
export function deleteConversationTutorPlan(conversationId) {
    getDb()
        .prepare(`
        DELETE FROM conversation_tutor_plans
        WHERE conversation_id = ?
      `)
        .run(conversationId);
    touchConversation(conversationId);
}
export function listChatRoomMessages(conversationId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(conversationId);
    return rows.map(toStoredChatRoomMessage);
}
export function findChatRoomMessage(conversationId, messageId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId, messageId);
    return row ? toStoredChatRoomMessage(row) : null;
}
export function addChatRoomMessage(conversationId, senderType, senderName, content) {
    const db = getDb();
    const result = db
        .prepare(`
        INSERT INTO chat_room_messages (conversation_id, sender_type, sender_name, content)
        VALUES (?, ?, ?, ?)
      `)
        .run(conversationId, senderType, senderName, content);
    touchChatRoomConversation(conversationId);
    const row = db
        .prepare(`
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
      `)
        .get(result.lastInsertRowid);
    return toStoredChatRoomMessage(row);
}
export function updateChatRoomMessageEvaluation(input) {
    const db = getDb();
    db.prepare(`
      UPDATE chat_room_messages
      SET evaluation_status = ?,
          evaluation_problem = ?,
          evaluation_created_at = CURRENT_TIMESTAMP
      WHERE id = ? AND conversation_id = ?
    `).run(input.status, input.status === 'warning' ? (input.problem?.trim() || null) : null, input.messageId, input.conversationId);
    const row = db.prepare(`
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
    `).get(input.messageId, input.conversationId);
    return row ? toStoredChatRoomMessage(row) : null;
}
function parseMetadata(metadata) {
    try {
        const parsed = JSON.parse(metadata);
        return parsed && typeof parsed === 'object'
            ? parsed
            : null;
    }
    catch {
        return null;
    }
}
function parseTutorPlanJson(planJson) {
    try {
        const parsed = JSON.parse(planJson);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        const record = parsed;
        const title = typeof record.title === 'string' ? record.title.trim() : '';
        const summary = typeof record.summary === 'string' && record.summary.trim()
            ? record.summary.trim()
            : undefined;
        const rawSteps = Array.isArray(record.steps) ? record.steps : [];
        const steps = rawSteps
            .map((step) => {
            if (!step || typeof step !== 'object') {
                return null;
            }
            const stepRecord = step;
            const id = typeof stepRecord.id === 'string' ? stepRecord.id.trim() : '';
            const label = typeof stepRecord.label === 'string' ? stepRecord.label.trim() : '';
            const status = stepRecord.status;
            if (!id ||
                !label ||
                (status !== 'active' &&
                    status !== 'done' &&
                    status !== 'pending' &&
                    status !== 'skipped')) {
                return null;
            }
            return {
                id,
                label,
                status,
            };
        })
            .filter((step) => Boolean(step));
        if (!title || steps.length === 0) {
            return null;
        }
        return {
            steps,
            summary,
            title,
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=repository.js.map