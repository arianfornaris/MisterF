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
          active_agent,
          model_tier
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .run(id, userId, profileId, title, options.practiceModuleId ?? null, 'tutor', options.modelTier ?? 'regular');
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
export function findConversationForUser(id, userId) {
    const row = getDb()
        .prepare(`
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
             , model_tier
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
             , model_tier
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