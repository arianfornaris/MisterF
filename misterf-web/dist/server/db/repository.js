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
        instructionLanguage: row.instruction_language,
        profileOnboardingCompletedAt: row.profile_onboarding_completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toStoredConversation(row) {
    return {
        activeAgent: 'tutor',
        closedAt: row.closed_at,
        practiceGuideId: row.practice_guide_id,
        id: row.id,
        instructionLanguage: row.instruction_language,
        modelTier: row.model_tier,
        profileId: row.profile_id,
        title: row.title,
        titleUpdatedByUser: Boolean(row.title_updated_by_user),
        userId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toStoredResource(row) {
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
function toStoredAccessibleResource(row) {
    return {
        ...toStoredResource(row),
        accessCreatedAt: row.access_created_at,
        accessKind: row.access_kind,
        grantId: row.grant_id,
        grantedVia: row.granted_via,
        shareLinkId: row.share_link_id,
    };
}
function toStoredResourceAccessGrant(row) {
    return {
        collectResults: row.collect_results === 1,
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
function toStoredResourceFolderItem(row) {
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
function toStoredResourceFolderMoveOption(row) {
    return {
        ...toStoredResource(row),
        parentFolderId: row.parent_folder_id,
    };
}
function toStoredResourceShareLink(row) {
    return {
        collectResults: row.collect_results === 1,
        createdAt: row.created_at,
        id: row.id,
        resourceId: row.resource_id,
        revokedAt: row.revoked_at,
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
        practiceGuideId: row.practice_guide_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
function parsePracticeGuideAuthoringMessages(value) {
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
                role,
            }];
    })
        .slice(-50);
}
function parseQuizAuthoringMessages(value) {
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
function parseStringArray(value, maxItemLength = 180) {
    return parseJsonArray(value)
        .flatMap((item) => {
        if (typeof item !== 'string') {
            return [];
        }
        const normalized = item.replace(/\s+/g, ' ').trim().slice(0, maxItemLength);
        return normalized ? [normalized] : [];
    })
        .slice(0, 24);
}
function parseRoleplayAuthoringMessages(value) {
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
function parseRoleplayCharacters(value) {
    return parseJsonArray(value)
        .flatMap((item) => {
        if (!isPlainRecord(item)) {
            return [];
        }
        const id = readStringFromRecord(item, 'id').slice(0, 64);
        const name = readStringFromRecord(item, 'name').slice(0, 120);
        if (!id || !name) {
            return [];
        }
        const avatarId = readStringFromRecord(item, 'avatarId').slice(0, 64);
        return [{
                ...(avatarId ? { avatarId } : {}),
                description: readStringFromRecord(item, 'description').slice(0, 1200),
                id,
                name,
            }];
    })
        .slice(0, 2);
}
function parseRoleplayTurns(value) {
    return parseJsonArray(value)
        .flatMap((item) => {
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
function toStoredQuiz(row) {
    return {
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
function toStoredQuizAttempt(row) {
    return {
        quizId: row.quiz_id,
        claimToken: row.claim_token,
        collectResults: row.collect_results === 1,
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
function toStoredConversationQuizAttemptSnapshot(row) {
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
function toStoredRoleplay(row) {
    return {
        archivedAt: row.archived_at,
        authoringMessages: parseRoleplayAuthoringMessages(row.authoring_messages_json),
        characters: parseRoleplayCharacters(row.characters_json),
        createdAt: row.created_at,
        description: row.description,
        id: row.id,
        level: row.level,
        profileId: row.profile_id,
        sharedVia: row.shared_via,
        sourceProfileId: row.source_profile_id,
        sourceRoleplayId: row.source_roleplay_id,
        sourceUserId: row.source_user_id,
        title: row.title,
        updatedAt: row.updated_at,
        userId: row.user_id,
    };
}
function toStoredRoleplayAttempt(row) {
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
function toStoredConversationRoleplayAttemptSnapshot(row) {
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
    }
    catch {
        return fallback;
    }
}
function isKnownResourceType(value) {
    return (value === 'quiz' ||
        value === 'practice_guide' ||
        value === 'resource_folder' ||
        value === 'roleplay');
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
function toStoredPracticeGuide(row) {
    return {
        archivedAt: row.archived_at,
        authoringMessages: parsePracticeGuideAuthoringMessages(row.authoring_messages_json),
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
function toStoredConversationPracticeGuideSnapshot(row) {
    return {
        practiceGuideId: row.practice_guide_id,
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
function insertResource(db, input) {
    db.prepare(`
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
    `).run(input.id, input.userId, input.profileId, input.type, input.title, input.description ?? '', input.topic ?? '', input.level ?? '', input.archivedAt ?? null, input.sourceResourceId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
}
function updateResourceMetadata(db, input) {
    db.prepare(`
      UPDATE resources
      SET title = ?,
          description = ?,
          topic = COALESCE(?, topic),
          level = COALESCE(?, level),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(input.title, input.description, input.topic ?? null, input.level ?? null, input.id, input.userId);
}
function archiveResource(db, resourceId, userId) {
    db.prepare(`
      UPDATE resources
      SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(resourceId, userId);
}
function restoreResource(db, resourceId, userId) {
    db.prepare(`
      UPDATE resources
      SET archived_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(resourceId, userId);
}
function upsertResourceShareLink(db, id, resourceId) {
    db.prepare(`
      INSERT INTO resource_share_links (id, resource_id)
      VALUES (?, ?)
      ON CONFLICT(resource_id) DO UPDATE SET
        revoked_at = NULL
    `).run(id, resourceId);
}
function normalizeResourceFolderPositions(folderId) {
    const db = getDb();
    const rows = db
        .prepare(`
        SELECT resource_id
        FROM resource_folder_items
        WHERE folder_id = ?
        ORDER BY position ASC, created_at ASC
      `)
        .all(folderId);
    const update = db.prepare(`
      UPDATE resource_folder_items
      SET position = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE folder_id = ? AND resource_id = ?
    `);
    rows.forEach((row, index) => {
        update.run(index + 1, folderId, row.resource_id);
    });
}
export function findResourceForUser(resourceId, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(resourceId, userId);
    return row ? toStoredResource(row) : null;
}
export function findResourceById(resourceId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(resourceId);
    return row ? toStoredResource(row) : null;
}
export function findResourceAccessForProfile(input) {
    const includeArchived = input.includeArchived ? 1 : 0;
    const row = getDb()
        .prepare(`
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
      `)
        .get(input.resourceId, input.resourceId, input.userId, input.profileId, input.resourceId, input.userId, input.profileId, input.resourceId, input.userId, input.profileId, includeArchived);
    return row ? toStoredAccessibleResource(row) : null;
}
export function findResourceFolderForResource(resourceId, userId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(resourceId, userId, userId);
    return row ? toStoredResource(row) : null;
}
export function listResourceFolderPath(folderId, userId) {
    const path = [];
    const seenFolderIds = new Set();
    let currentFolder = findResourceForUser(folderId, userId);
    while (currentFolder?.type === 'resource_folder' && !seenFolderIds.has(currentFolder.id)) {
        path.unshift(currentFolder);
        seenFolderIds.add(currentFolder.id);
        currentFolder = findResourceFolderForResource(currentFolder.id, userId);
    }
    return path;
}
export function listAccessibleResourceFolderPath(input) {
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
        .map((folder) => findResourceAccessForProfile({
        includeArchived: input.includeArchived,
        profileId: input.profileId,
        resourceId: folder.id,
        userId: input.userId,
    }))
        .filter((folder) => (folder?.type === 'resource_folder'));
}
export function listResourceFolderPathForResource(resourceId, userId) {
    const parentFolder = findResourceFolderForResource(resourceId, userId);
    return parentFolder ? listResourceFolderPath(parentFolder.id, userId) : [];
}
export function listResourceFolderDescendantIds(folderId, userId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(folderId, userId, userId);
    return rows.map((row) => row.id);
}
export function listResourceFoldersForProfile(input) {
    const includeArchived = input.includeArchived ? 1 : 0;
    const rows = getDb()
        .prepare(`
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
      `)
        .all(input.userId, input.profileId, includeArchived);
    return rows.map(toStoredResourceFolderMoveOption);
}
export function listResourcesForProfile(input) {
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
            .prepare(`
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
        `)
            .all(input.userId, input.profileId, input.userId, input.profileId, folderAccess.grantId, input.userId, input.profileId, folderAccess.grantedVia, input.userId, input.profileId, folderAccess.shareLinkId, input.userId, input.profileId, folderAccess.accessCreatedAt, input.folderId, input.type ?? null, input.type ?? null, includeArchived);
        return rows.map(toStoredAccessibleResource);
    }
    const rows = getDb()
        .prepare(`
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
      `)
        .all(input.userId, input.profileId, input.type ?? null, input.type ?? null, includeArchived, input.userId, input.profileId, input.type ?? null, input.type ?? null, includeArchived);
    const uniqueResources = new Map();
    for (const row of rows.map(toStoredAccessibleResource)) {
        if (!uniqueResources.has(row.id)) {
            uniqueResources.set(row.id, row);
        }
    }
    return Array.from(uniqueResources.values());
}
/**
 * Resources the active profile owns and has put up for sharing: non-folder,
 * non-archived, with at least one active share link or active access grant.
 * Powers the "Shared by me" guide entry point (roadmap V3 §1.6). A resource
 * with a live link but no practicers still counts — it has been shared.
 */
export function listSharedResourcesForProfile(input) {
    const rows = getDb()
        .prepare(`
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
          (
            SELECT COUNT(*)
            FROM resource_access_grants AS grant_row
            WHERE grant_row.resource_id = resource.id
              AND grant_row.revoked_at IS NULL
          ) AS active_grant_count,
          (
            SELECT COUNT(*)
            FROM resource_share_links AS share_link
            WHERE share_link.resource_id = resource.id
              AND share_link.revoked_at IS NULL
          ) AS active_link_count
        FROM resources AS resource
        WHERE resource.user_id = ?
          AND resource.profile_id = ?
          AND resource.type != 'resource_folder'
          AND resource.archived_at IS NULL
          AND (
            EXISTS (
              SELECT 1
              FROM resource_access_grants AS grant_row
              WHERE grant_row.resource_id = resource.id
                AND grant_row.revoked_at IS NULL
            )
            OR EXISTS (
              SELECT 1
              FROM resource_share_links AS share_link
              WHERE share_link.resource_id = resource.id
                AND share_link.revoked_at IS NULL
            )
          )
        ORDER BY resource.updated_at DESC, resource.created_at DESC
      `)
        .all(input.userId, input.profileId);
    return rows.map((row) => ({
        ...toStoredAccessibleResource(row),
        activeGrantCount: row.active_grant_count,
        hasActiveLink: row.active_link_count > 0,
    }));
}
export function createResourceFolder(input) {
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
export function updateResourceFolder(input) {
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
export function archiveResourceForUser(resourceId, userId) {
    const resource = findResourceForUser(resourceId, userId);
    if (!resource) {
        return null;
    }
    const db = getDb();
    const transaction = db.transaction(() => {
        archiveResource(db, resourceId, userId);
        if (resource.type === 'quiz') {
            db.prepare(`
          UPDATE quizzes
          SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).run(resourceId, userId);
        }
        else if (resource.type === 'practice_guide') {
            db.prepare(`
          UPDATE practice_guides
          SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).run(resourceId, userId);
        }
        else if (resource.type === 'roleplay') {
            db.prepare(`
          UPDATE roleplays
          SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).run(resourceId, userId);
        }
    });
    transaction();
    return findResourceForUser(resourceId, userId);
}
export function restoreResourceForUser(resourceId, userId) {
    const resource = findResourceForUser(resourceId, userId);
    if (!resource) {
        return null;
    }
    const db = getDb();
    const transaction = db.transaction(() => {
        restoreResource(db, resourceId, userId);
        if (resource.type === 'quiz') {
            db.prepare(`
          UPDATE quizzes
          SET archived_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).run(resourceId, userId);
        }
        else if (resource.type === 'practice_guide') {
            db.prepare(`
          UPDATE practice_guides
          SET archived_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).run(resourceId, userId);
        }
        else if (resource.type === 'roleplay') {
            db.prepare(`
          UPDATE roleplays
          SET archived_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).run(resourceId, userId);
        }
    });
    transaction();
    return findResourceForUser(resourceId, userId);
}
export function addResourceToFolder(input) {
    const folder = findResourceForUser(input.folderId, input.userId);
    const resource = findResourceForUser(input.resourceId, input.userId);
    if (folder?.type !== 'resource_folder'
        || !resource
        || folder.archivedAt
        || resource.archivedAt
        || folder.profileId !== resource.profileId) {
        return false;
    }
    const db = getDb();
    const previous = db
        .prepare('SELECT folder_id FROM resource_folder_items WHERE resource_id = ?')
        .get(input.resourceId);
    if (previous?.folder_id === input.folderId) {
        return false;
    }
    if (resource.type === 'resource_folder') {
        if (resource.id === folder.id) {
            return false;
        }
        const descendantFolderIds = new Set(listResourceFolderDescendantIds(resource.id, input.userId));
        if (descendantFolderIds.has(folder.id)) {
            return false;
        }
    }
    const nextPositionRow = db
        .prepare(`
        SELECT COALESCE(MAX(position), 0) AS max_position
        FROM resource_folder_items
        WHERE folder_id = ?
      `)
        .get(input.folderId);
    const transaction = db.transaction(() => {
        db.prepare(`
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
      `).run(input.folderId, input.resourceId, resource.type, nextPositionRow.max_position + 1);
        db.prepare(`
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id IN (?, ?)
      `).run(input.folderId, input.resourceId);
    });
    transaction();
    if (previous?.folder_id && previous.folder_id !== input.folderId) {
        normalizeResourceFolderPositions(previous.folder_id);
    }
    normalizeResourceFolderPositions(input.folderId);
    return true;
}
export function removeResourceFromFolder(input) {
    const folder = findResourceForUser(input.folderId, input.userId);
    const resource = findResourceForUser(input.resourceId, input.userId);
    if (folder?.type !== 'resource_folder' || !resource) {
        return false;
    }
    const result = getDb()
        .prepare(`
        DELETE FROM resource_folder_items
        WHERE folder_id = ? AND resource_id = ?
      `)
        .run(input.folderId, input.resourceId);
    if (result.changes < 1) {
        return false;
    }
    normalizeResourceFolderPositions(input.folderId);
    return true;
}
export function listResourceFolderItems(folderId, userId) {
    const folder = findResourceForUser(folderId, userId);
    if (folder?.type !== 'resource_folder') {
        return [];
    }
    const rows = getDb()
        .prepare(`
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
      `)
        .all(folderId, userId);
    return rows.map(toStoredResourceFolderItem);
}
export function moveResourceFolderItem(input) {
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
        db.prepare(`
        UPDATE resource_folder_items
        SET position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE folder_id = ? AND resource_id = ?
      `).run(-1, input.folderId, current.resourceId);
        db.prepare(`
        UPDATE resource_folder_items
        SET position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE folder_id = ? AND resource_id = ?
      `).run(current.position, input.folderId, other.resourceId);
        db.prepare(`
        UPDATE resource_folder_items
        SET position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE folder_id = ? AND resource_id = ?
      `).run(other.position, input.folderId, current.resourceId);
        db.prepare(`
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(input.folderId);
    });
    transaction();
    return true;
}
export function findResourceShareLinkById(id) {
    const row = getDb()
        .prepare(`
        SELECT id, resource_id, collect_results, created_at, revoked_at
        FROM resource_share_links
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredResourceShareLink(row) : null;
}
export function findResourceShareLinkForResource(resourceId) {
    const row = getDb()
        .prepare(`
        SELECT id, resource_id, collect_results, created_at, revoked_at
        FROM resource_share_links
        WHERE resource_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `)
        .get(resourceId);
    return row ? toStoredResourceShareLink(row) : null;
}
export function getOrCreateResourceShareLink(resourceId) {
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
export function setResourceShareLinkCollectResults(input) {
    getDb()
        .prepare(`
        UPDATE resource_share_links
        SET collect_results = ?
        WHERE resource_id = ?
      `)
        .run(input.collectResults ? 1 : 0, input.resourceId);
}
export function findResourceAccessGrant(input) {
    const row = getDb()
        .prepare(`
        SELECT
          id,
          resource_id,
          user_id,
          profile_id,
          granted_by_user_id,
          granted_via,
          share_link_id,
          collect_results,
          created_at,
          updated_at,
          revoked_at
        FROM resource_access_grants
        WHERE resource_id = ?
          AND user_id = ?
          AND profile_id = ?
        LIMIT 1
      `)
        .get(input.resourceId, input.userId, input.profileId);
    return row ? toStoredResourceAccessGrant(row) : null;
}
export function grantResourceAccess(input) {
    const resource = findResourceById(input.resourceId);
    if (!resource || resource.archivedAt) {
        return null;
    }
    if (resource.userId === input.userId && resource.profileId === input.profileId) {
        return null;
    }
    const collectResults = input.collectResults ?? true;
    const id = randomUUID();
    getDb()
        .prepare(`
        INSERT INTO resource_access_grants (
          id,
          resource_id,
          user_id,
          profile_id,
          granted_by_user_id,
          granted_via,
          share_link_id,
          collect_results
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(resource_id, user_id, profile_id) DO UPDATE SET
          granted_by_user_id = excluded.granted_by_user_id,
          granted_via = excluded.granted_via,
          share_link_id = excluded.share_link_id,
          collect_results = excluded.collect_results,
          revoked_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `)
        .run(id, input.resourceId, input.userId, input.profileId, input.grantedByUserId, input.grantedVia, input.shareLinkId ?? null, collectResults ? 1 : 0);
    return findResourceAccessGrant({
        profileId: input.profileId,
        resourceId: input.resourceId,
        userId: input.userId,
    });
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
          instruction_language,
          profile_onboarding_completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(id, input.userId, input.name, input.description ?? '', input.learningContext ?? '', input.modelTier ?? 'regular', input.instructionLanguage ?? 'es', input.profileOnboardingCompleted === false ? null : new Date().toISOString());
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
          instruction_language,
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
          instruction_language,
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
          instruction_language,
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
export function ensureUserHasProfile(userId, instructionLanguage) {
    const existingProfiles = listProfilesForUser(userId);
    if (existingProfiles.length > 0) {
        return existingProfiles[0];
    }
    return createProfile({
        description: '',
        instructionLanguage,
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
            instruction_language = COALESCE(?, instruction_language),
            profile_onboarding_completed_at = CASE
              WHEN ? = 1 THEN COALESCE(profile_onboarding_completed_at, CURRENT_TIMESTAMP)
              ELSE profile_onboarding_completed_at
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(input.name, input.description, input.learningContext ?? null, input.modelTier ?? null, input.instructionLanguage ?? null, input.profileOnboardingCompleted ? 1 : 0, input.profileId, input.userId);
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
export function updateProfileInstructionLanguageForUser(profileId, userId, instructionLanguage) {
    getDb()
        .prepare(`
        UPDATE profiles
        SET instruction_language = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(instructionLanguage, profileId, userId);
    return findProfileForUser(profileId, userId);
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
    const profile = findProfileById(profileId);
    const modelTier = options.modelTier ?? profile?.modelTier ?? 'regular';
    const instructionLanguage = profile?.instructionLanguage ?? 'es';
    getDb()
        .prepare(`
        INSERT INTO conversations (
          id,
          user_id,
          profile_id,
          title,
          practice_guide_id,
          active_agent,
          model_tier,
          instruction_language
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(id, userId, profileId, title, options.practiceGuideId ?? null, 'tutor', modelTier, instructionLanguage);
    const conversation = findConversationForUser(id, userId);
    if (!conversation) {
        throw new Error('Could not load newly created conversation.');
    }
    return conversation;
}
export function createConversationFromPracticeGuide(userId, practiceGuide, profileId = practiceGuide.profileId) {
    const conversation = createConversation(userId, profileId, defaultConversationTitle, {
        practiceGuideId: practiceGuide.id,
    });
    createConversationPracticeGuideSnapshot(conversation.id, practiceGuide);
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_guide_id, profile_id, active_agent
             , model_tier, instruction_language
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_guide_id, profile_id, active_agent
             , model_tier, instruction_language
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
          practice_guide_id,
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
export function setTutorConversationReportPracticeGuide(input) {
    getDb()
        .prepare(`
        UPDATE tutor_conversation_reports
        SET practice_guide_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `)
        .run(input.practiceGuideId, input.conversationId, input.userId);
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
export function createQuiz(input) {
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
        db.prepare(`
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
      `)
            .run(id, input.userId, input.profileId, input.title, input.description ?? '', input.targetTopic ?? '', input.level ?? '', input.instructions ?? '', JSON.stringify(input.quiz), JSON.stringify(input.authoringMessages ?? []), input.sourceQuizId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
    });
    transaction();
    const quiz = findQuizForUser(id, input.userId);
    if (!quiz) {
        throw new Error('Could not load newly created quiz.');
    }
    return quiz;
}
export function findQuizForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT
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
      `)
        .get(id, userId);
    return row ? toStoredQuiz(row) : null;
}
export function findQuizById(id) {
    const row = getDb()
        .prepare(`
        SELECT
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
      `)
        .get(id);
    return row ? toStoredQuiz(row) : null;
}
export function listQuizzesForProfile(input) {
    const rows = getDb()
        .prepare(`
        SELECT
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
      `)
        .all(input.userId, input.profileId, input.includeArchived ? 1 : 0);
    return rows.map(toStoredQuiz);
}
export function updateQuiz(input) {
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
        db.prepare(`
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
      `)
            .run(input.title, input.description, input.targetTopic, input.level, input.instructions, JSON.stringify(input.quiz), input.authoringMessages === undefined
            ? null
            : JSON.stringify(input.authoringMessages), input.quizId, input.userId);
    });
    transaction();
    return findQuizForUser(input.quizId, input.userId);
}
export function updateQuizAuthoringMessages(input) {
    const db = getDb();
    const transaction = db.transaction(() => {
        db.prepare(`
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(input.quizId, input.userId);
        db.prepare(`
        UPDATE quizzes
        SET authoring_messages_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
            .run(JSON.stringify(input.messages), input.quizId, input.userId);
    });
    transaction();
    return findQuizForUser(input.quizId, input.userId);
}
export function findImportedQuizForProfile(input) {
    const row = getDb()
        .prepare(`
        SELECT
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
      `)
        .get(input.userId, input.profileId, input.sourceQuizId);
    return row ? toStoredQuiz(row) : null;
}
export function importQuizToProfile(input) {
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
export function archiveQuizForUser(quizId, userId) {
    const db = getDb();
    const transaction = db.transaction(() => {
        archiveResource(db, quizId, userId);
        db.prepare(`
        UPDATE quizzes
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
            .run(quizId, userId);
    });
    transaction();
    return findQuizForUser(quizId, userId);
}
export function restoreQuizForUser(quizId, userId) {
    const db = getDb();
    const transaction = db.transaction(() => {
        restoreResource(db, quizId, userId);
        db.prepare(`
        UPDATE quizzes
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
            .run(quizId, userId);
    });
    transaction();
    return findQuizForUser(quizId, userId);
}
export function createQuizAttempt(input) {
    const id = randomUUID();
    const isGuest = !input.userId;
    const guestToken = isGuest ? randomBytes(24).toString('base64url') : null;
    const claimToken = isGuest ? randomBytes(24).toString('base64url') : null;
    getDb()
        .prepare(`
        INSERT INTO quiz_attempts (
          id,
          quiz_id,
          user_id,
          profile_id,
          guest_token,
          claim_token,
          snapshot_json,
          collect_results
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(id, input.quizId, input.userId ?? null, input.profileId ?? null, guestToken, claimToken, JSON.stringify(input.snapshot), input.collectResults ? 1 : 0);
    const attempt = findQuizAttemptById(id);
    if (!attempt) {
        throw new Error('Could not load newly created quiz attempt.');
    }
    return attempt;
}
export function findQuizAttemptById(id) {
    const row = getDb()
        .prepare(`
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
          user_id,
          collect_results
        FROM quiz_attempts
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredQuizAttempt(row) : null;
}
export function findQuizAttemptForUser(id, userId) {
    const attempt = findQuizAttemptById(id);
    return attempt?.userId === userId ? attempt : null;
}
export function findQuizAttemptByGuestToken(guestToken) {
    const row = getDb()
        .prepare(`
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
          user_id,
          collect_results
        FROM quiz_attempts
        WHERE guest_token = ?
      `)
        .get(guestToken);
    return row ? toStoredQuizAttempt(row) : null;
}
export function findQuizAttemptByClaimToken(claimToken) {
    const row = getDb()
        .prepare(`
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
          user_id,
          collect_results
        FROM quiz_attempts
        WHERE claim_token = ?
      `)
        .get(claimToken);
    return row ? toStoredQuizAttempt(row) : null;
}
export function listQuizAttemptsForUser(input) {
    const rows = getDb()
        .prepare(`
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
          user_id,
          collect_results
        FROM quiz_attempts
        WHERE user_id = ?
          AND profile_id = ?
          AND (? IS NULL OR quiz_id = ?)
        ORDER BY created_at DESC
      `)
        .all(input.userId, input.profileId, input.quizId ?? null, input.quizId ?? null);
    return rows.map(toStoredQuizAttempt);
}
/**
 * Attempts whose share collected results for the resource owner: only
 * attempts that snapshotted collect_results at start, and never the quiz
 * author profile's own attempts (the owner's `Probar` runs). This is keyed on
 * the author profile rather than the owner user, so attempts by sibling
 * profiles in the same account (for example a parent's child profile) still
 * surface.
 */
export function listCollectedQuizAttemptsForOwner(input) {
    const rows = getDb()
        .prepare(`
        SELECT
          qa.quiz_id,
          qa.claim_token,
          qa.created_at,
          qa.evaluated_at,
          qa.guest_token,
          qa.id,
          qa.profile_id,
          qa.progress_event_id,
          qa.responses_json,
          qa.result_json,
          qa.snapshot_json,
          qa.started_at,
          qa.status,
          qa.submitted_at,
          qa.updated_at,
          qa.user_id,
          qa.collect_results,
          users.email AS participant_email,
          users.full_name AS participant_name,
          profiles.name AS participant_profile_name
        FROM quiz_attempts qa
        LEFT JOIN users ON users.id = qa.user_id
        LEFT JOIN profiles ON profiles.id = qa.profile_id
        WHERE qa.quiz_id = ?
          AND qa.collect_results = 1
          AND (qa.profile_id IS NULL OR qa.profile_id != ?)
        ORDER BY qa.created_at DESC
      `)
        .all(input.quizId, input.authorProfileId);
    return rows.map((row) => ({
        ...toStoredQuizAttempt(row),
        participantEmail: row.participant_email,
        participantName: row.participant_name,
        participantProfileName: row.participant_profile_name,
    }));
}
export function getQuizResponseSummary(quizId) {
    const row = getDb()
        .prepare(`
        SELECT quiz_id, summary_text, input_fingerprint, generated_at
        FROM quiz_response_summaries
        WHERE quiz_id = ?
      `)
        .get(quizId);
    return row
        ? {
            generatedAt: row.generated_at,
            inputFingerprint: row.input_fingerprint,
            quizId: row.quiz_id,
            summaryText: row.summary_text,
        }
        : null;
}
export function upsertQuizResponseSummary(input) {
    getDb()
        .prepare(`
        INSERT INTO quiz_response_summaries (
          quiz_id,
          summary_text,
          input_fingerprint,
          generated_at
        )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(quiz_id) DO UPDATE SET
          summary_text = excluded.summary_text,
          input_fingerprint = excluded.input_fingerprint,
          generated_at = CURRENT_TIMESTAMP
      `)
        .run(input.quizId, input.summaryText, input.inputFingerprint);
}
export function submitQuizAttempt(input) {
    getDb()
        .prepare(`
        UPDATE quiz_attempts
        SET responses_json = ?,
            status = 'submitted',
            submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('draft', 'failed')
      `)
        .run(JSON.stringify(input.responses), input.attemptId);
    return findQuizAttemptById(input.attemptId);
}
export function markQuizAttemptEvaluating(attemptId) {
    getDb()
        .prepare(`
        UPDATE quiz_attempts
        SET status = 'evaluating',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(attemptId);
    return findQuizAttemptById(attemptId);
}
export function saveQuizAttemptResult(input) {
    getDb()
        .prepare(`
        UPDATE quiz_attempts
        SET result_json = ?,
            status = 'evaluated',
            evaluated_at = COALESCE(evaluated_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(JSON.stringify(input.result), input.attemptId);
    return findQuizAttemptById(input.attemptId);
}
export function markQuizAttemptFailed(attemptId) {
    getDb()
        .prepare(`
        UPDATE quiz_attempts
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(attemptId);
    return findQuizAttemptById(attemptId);
}
export function attachQuizAttemptToUser(input) {
    getDb()
        .prepare(`
        UPDATE quiz_attempts
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
    return findQuizAttemptById(input.attemptId);
}
export function setQuizAttemptProgressEvent(input) {
    getDb()
        .prepare(`
        UPDATE quiz_attempts
        SET progress_event_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(input.progressEventId, input.attemptId);
    return findQuizAttemptById(input.attemptId);
}
export function createConversationFromQuizAttempt(input) {
    const title = readStringFromRecord(input.attempt.snapshot, 'title') || defaultConversationTitle;
    const conversation = createConversation(input.userId, input.profileId, `Practicar: ${title}`);
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
export function createConversationQuizAttemptSnapshot(conversationId, attempt) {
    getDb()
        .prepare(`
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
      `)
        .run(conversationId, attempt.id, readStringFromRecord(attempt.snapshot, 'title'), readStringFromRecord(attempt.snapshot, 'description'), readStringFromRecord(attempt.snapshot, 'targetTopic'), JSON.stringify(attempt.snapshot), JSON.stringify(attempt.responses), JSON.stringify(attempt.result ?? {}));
    const snapshot = getConversationQuizAttemptSnapshot(conversationId);
    if (!snapshot) {
        throw new Error('Could not load conversation quiz-attempt snapshot.');
    }
    return snapshot;
}
export function getConversationQuizAttemptSnapshot(conversationId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId);
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
  profile_id,
  shared_via,
  source_profile_id,
  source_roleplay_id,
  source_user_id,
  title,
  updated_at,
  user_id
`;
export function createRoleplay(input) {
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
        db.prepare(`
        INSERT INTO roleplays (
          id,
          user_id,
          profile_id,
          title,
          description,
          level,
          characters_json,
          authoring_messages_json,
          source_roleplay_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.userId, input.profileId, input.title, input.description ?? '', input.level ?? '', JSON.stringify(input.characters), JSON.stringify(input.authoringMessages ?? []), input.sourceRoleplayId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
    });
    transaction();
    const roleplay = findRoleplayForUser(id, input.userId);
    if (!roleplay) {
        throw new Error('Could not load newly created roleplay.');
    }
    return roleplay;
}
export function findRoleplayForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT ${roleplaySelectColumns}
        FROM roleplays
        WHERE id = ? AND user_id = ?
      `)
        .get(id, userId);
    return row ? toStoredRoleplay(row) : null;
}
export function findRoleplayById(id) {
    const row = getDb()
        .prepare(`
        SELECT ${roleplaySelectColumns}
        FROM roleplays
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredRoleplay(row) : null;
}
export function updateRoleplay(input) {
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
        db.prepare(`
        UPDATE roleplays
        SET title = ?,
            description = ?,
            level = ?,
            characters_json = ?,
            authoring_messages_json = COALESCE(?, authoring_messages_json),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(input.title, input.description, input.level, JSON.stringify(input.characters), input.authoringMessages === undefined
            ? null
            : JSON.stringify(input.authoringMessages), input.roleplayId, input.userId);
    });
    transaction();
    return findRoleplayForUser(input.roleplayId, input.userId);
}
export function updateRoleplayAuthoringMessages(input) {
    const db = getDb();
    const transaction = db.transaction(() => {
        db.prepare(`
        UPDATE resources
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(input.roleplayId, input.userId);
        db.prepare(`
        UPDATE roleplays
        SET authoring_messages_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(JSON.stringify(input.messages), input.roleplayId, input.userId);
    });
    transaction();
    return findRoleplayForUser(input.roleplayId, input.userId);
}
export function archiveRoleplayForUser(roleplayId, userId) {
    const db = getDb();
    const transaction = db.transaction(() => {
        archiveResource(db, roleplayId, userId);
        db.prepare(`
        UPDATE roleplays
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(roleplayId, userId);
    });
    transaction();
    return findRoleplayForUser(roleplayId, userId);
}
export function restoreRoleplayForUser(roleplayId, userId) {
    const db = getDb();
    const transaction = db.transaction(() => {
        restoreResource(db, roleplayId, userId);
        db.prepare(`
        UPDATE roleplays
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(roleplayId, userId);
    });
    transaction();
    return findRoleplayForUser(roleplayId, userId);
}
export function createRoleplayAttempt(input) {
    const id = randomUUID();
    getDb()
        .prepare(`
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
      `).run(id, input.roleplayId, input.userId ?? null, input.profileId ?? null, JSON.stringify(input.snapshot), JSON.stringify(input.turns));
    const attempt = findRoleplayAttemptById(id);
    if (!attempt) {
        throw new Error('Could not load newly created roleplay attempt.');
    }
    return attempt;
}
export function findRoleplayAttemptById(id) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(id);
    return row ? toStoredRoleplayAttempt(row) : null;
}
export function listRoleplayAttemptsForUser(input) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(input.userId, input.profileId, input.roleplayId ?? null, input.roleplayId ?? null);
    return rows.map(toStoredRoleplayAttempt);
}
export function appendRoleplayAttemptTurns(input) {
    const attempt = findRoleplayAttemptById(input.attemptId);
    if (!attempt || attempt.status !== 'in_progress') {
        return attempt;
    }
    getDb()
        .prepare(`
        UPDATE roleplay_attempts
        SET turns_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify([...attempt.turns, ...input.turns]), input.attemptId);
    return findRoleplayAttemptById(input.attemptId);
}
export function submitRoleplayAttempt(attemptId) {
    getDb()
        .prepare(`
        UPDATE roleplay_attempts
        SET status = 'evaluating',
            submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('in_progress', 'failed')
      `).run(attemptId);
    return findRoleplayAttemptById(attemptId);
}
export function saveRoleplayAttemptResult(input) {
    getDb()
        .prepare(`
        UPDATE roleplay_attempts
        SET result_json = ?,
            status = 'evaluated',
            evaluated_at = COALESCE(evaluated_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(input.result), input.attemptId);
    return findRoleplayAttemptById(input.attemptId);
}
export function markRoleplayAttemptFailed(attemptId) {
    getDb()
        .prepare(`
        UPDATE roleplay_attempts
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(attemptId);
    return findRoleplayAttemptById(attemptId);
}
export function setRoleplayAttemptProgressEvent(input) {
    getDb()
        .prepare(`
        UPDATE roleplay_attempts
        SET progress_event_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(input.progressEventId, input.attemptId);
    return findRoleplayAttemptById(input.attemptId);
}
export function createConversationFromRoleplayAttempt(input) {
    const title = readStringFromRecord(input.attempt.snapshot, 'title') || defaultConversationTitle;
    const conversation = createConversation(input.userId, input.profileId, `Practicar: ${title}`);
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
export function createConversationRoleplayAttemptSnapshot(conversationId, attempt) {
    getDb()
        .prepare(`
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
      `).run(conversationId, attempt.id, readStringFromRecord(attempt.snapshot, 'title'), readStringFromRecord(attempt.snapshot, 'description'), JSON.stringify(attempt.snapshot), JSON.stringify(attempt.turns), JSON.stringify(attempt.result ?? {}));
    const snapshot = getConversationRoleplayAttemptSnapshot(conversationId);
    if (!snapshot) {
        throw new Error('Could not load conversation roleplay-attempt snapshot.');
    }
    return snapshot;
}
export function getConversationRoleplayAttemptSnapshot(conversationId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(conversationId);
    return row ? toStoredConversationRoleplayAttemptSnapshot(row) : null;
}
function readStringFromRecord(record, key) {
    const value = record[key];
    return typeof value === 'string' ? value : '';
}
function addResourceSourceNoticeMessage(conversationId, input) {
    const resourceLabel = input.type === 'quiz' ? 'el quiz' : 'el Roleplay';
    const fallbackTitle = input.type === 'quiz' ? 'este quiz' : 'este Roleplay';
    const title = escapeMarkdownLinkText(input.title || fallbackTitle);
    addMessage(conversationId, 'model', [
        `Esta conversación se deriva de ${resourceLabel} [${title}](${input.resourcePath}) y de su [resultado](${input.resultPath}).`,
        'Vamos a practicar a partir de las dificultades encontradas.',
    ].join('\n\n'), {
        resourceSourceNotice: {
            attemptId: input.attemptId,
            resourceId: input.resourceId,
            type: input.type,
        },
    });
}
function escapeMarkdownLinkText(value) {
    return value.replace(/([\\\[\]])/g, '\\$1');
}
export function createPracticeGuide(input) {
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
        db.prepare(`
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
      `)
            .run(id, input.userId, input.profileId, input.title, input.description, input.tutorInstructions, input.sourcePracticeGuideId ?? null, input.sourceUserId ?? null, input.sourceProfileId ?? null, input.sharedVia ?? null);
    });
    transaction();
    const practiceGuide = findPracticeGuideForUser(id, input.userId);
    if (!practiceGuide) {
        throw new Error('Could not load newly created practice guide.');
    }
    return practiceGuide;
}
export function findPracticeGuideForUser(id, userId) {
    const row = getDb()
        .prepare(`
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
          shared_via,
          authoring_messages_json
        FROM practice_guides
        WHERE id = ? AND user_id = ?
      `)
        .get(id, userId);
    return row ? toStoredPracticeGuide(row) : null;
}
export function findPracticeGuideById(id) {
    const row = getDb()
        .prepare(`
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
          shared_via,
          authoring_messages_json
        FROM practice_guides
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredPracticeGuide(row) : null;
}
export function listPracticeGuidesForProfile(userId, profileId) {
    const rows = getDb()
        .prepare(`
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
          shared_via,
          authoring_messages_json
        FROM practice_guides
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)
        .all(userId, profileId);
    return rows.map(toStoredPracticeGuide);
}
export function deletePracticeGuideForUser(id, userId) {
    const db = getDb();
    const transaction = db.transaction(() => {
        db.prepare('DELETE FROM resource_folder_items WHERE resource_id = ?').run(id);
        db.prepare('DELETE FROM resources WHERE id = ? AND user_id = ?').run(id, userId);
        return db.prepare('DELETE FROM practice_guides WHERE id = ? AND user_id = ?').run(id, userId);
    });
    const result = transaction();
    return result.changes > 0;
}
export function archivePracticeGuideForUser(practiceGuideId, userId) {
    const db = getDb();
    const transaction = db.transaction(() => {
        archiveResource(db, practiceGuideId, userId);
        return db.prepare(`
        UPDATE practice_guides
        SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
            .run(practiceGuideId, userId);
    });
    const result = transaction();
    if (result.changes < 1) {
        return null;
    }
    return findPracticeGuideForUser(practiceGuideId, userId);
}
export function restorePracticeGuideForUser(practiceGuideId, userId) {
    const db = getDb();
    const transaction = db.transaction(() => {
        restoreResource(db, practiceGuideId, userId);
        return db.prepare(`
        UPDATE practice_guides
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
            .run(practiceGuideId, userId);
    });
    const result = transaction();
    if (result.changes < 1) {
        return null;
    }
    return findPracticeGuideForUser(practiceGuideId, userId);
}
export function listConversationsForPracticeGuide(practiceGuideId, userId, profileId) {
    const rows = getDb()
        .prepare(`
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, closed_at, practice_guide_id, profile_id, active_agent, model_tier, instruction_language
        FROM conversations
        WHERE user_id = ? AND profile_id = ? AND practice_guide_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)
        .all(userId, profileId, practiceGuideId);
    return rows.map(toStoredConversation);
}
export function updatePracticeGuide(input) {
    const db = getDb();
    const transaction = db.transaction(() => {
        updateResourceMetadata(db, {
            description: input.description,
            id: input.practiceGuideId,
            title: input.title,
            userId: input.userId,
        });
        db.prepare(`
        UPDATE practice_guides
        SET title = ?,
            description = ?,
            tutor_instructions = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
            .run(input.title, input.description, input.tutorInstructions, input.practiceGuideId, input.userId);
    });
    transaction();
    return findPracticeGuideForUser(input.practiceGuideId, input.userId);
}
export function findImportedPracticeGuideForProfile(input) {
    const row = getDb()
        .prepare(`
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
          shared_via,
          authoring_messages_json
        FROM practice_guides
        WHERE user_id = ?
          AND profile_id = ?
          AND source_practice_guide_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `)
        .get(input.userId, input.profileId, input.sourcePracticeGuideId);
    return row ? toStoredPracticeGuide(row) : null;
}
export function importPracticeGuideToProfile(input) {
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
export function createConversationPracticeGuideSnapshot(conversationId, practiceGuide) {
    getDb()
        .prepare(`
        INSERT OR REPLACE INTO conversation_practice_guide_snapshots (
          conversation_id,
          practice_guide_id,
          title,
          description,
          tutor_instructions
        )
        VALUES (?, ?, ?, ?, ?)
      `)
        .run(conversationId, practiceGuide.id, practiceGuide.title, practiceGuide.description, practiceGuide.tutorInstructions);
    const snapshot = getConversationPracticeGuideSnapshot(conversationId);
    if (!snapshot) {
        throw new Error('Could not load conversation practice-guide snapshot.');
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
export function getConversationPracticeGuideSnapshot(conversationId) {
    const row = getDb()
        .prepare(`
        SELECT conversation_id, practice_guide_id, title, description, tutor_instructions, created_at
        FROM conversation_practice_guide_snapshots
        WHERE conversation_id = ?
      `)
        .get(conversationId);
    return row ? toStoredConversationPracticeGuideSnapshot(row) : null;
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