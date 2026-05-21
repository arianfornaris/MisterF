import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from './database.js';
const defaultConversationTitle = 'Nueva conversación';
const defaultProfileName = 'Perfil principal';
function toStoredProfile(row) {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toStoredConversation(row) {
    return {
        activeAgent: 'tutor',
        chatRoomConversationReportId: row.chat_room_conversation_report_id,
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
export function createProfile(input) {
    const id = randomUUID();
    getDb()
        .prepare(`
        INSERT INTO profiles (id, user_id, name, description)
        VALUES (?, ?, ?, ?)
      `)
        .run(id, input.userId, input.name, input.description ?? '');
    const profile = findProfileForUser(id, input.userId);
    if (!profile) {
        throw new Error('Could not load newly created profile.');
    }
    return profile;
}
export function findProfileForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, name, description, created_at, updated_at
        FROM profiles
        WHERE id = ? AND user_id = ?
      `)
        .get(id, userId);
    return row ? toStoredProfile(row) : null;
}
export function findProfileById(id) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, name, description, created_at, updated_at
        FROM profiles
        WHERE id = ?
      `)
        .get(id);
    return row ? toStoredProfile(row) : null;
}
export function listProfilesForUser(userId) {
    const rows = getDb()
        .prepare(`
        SELECT id, user_id, name, description, created_at, updated_at
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
        userId,
    });
}
export function updateProfile(input) {
    getDb()
        .prepare(`
        UPDATE profiles
        SET name = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
        .run(input.name, input.description, input.profileId, input.userId);
    return findProfileForUser(input.profileId, input.userId);
}
export function createConversation(userId, profileId, title = defaultConversationTitle, options = {}) {
    const id = randomUUID();
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
        .run(id, userId, profileId, title, options.practiceModuleId ?? null, options.chatRoomConversationReportId ?? null, 'tutor', options.modelTier ?? 'regular');
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
export function findConversationForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
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
export function listConversationsForProfile(userId, profileId) {
    const rows = getDb()
        .prepare(`
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent, model_tier
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
//# sourceMappingURL=repository.js.map