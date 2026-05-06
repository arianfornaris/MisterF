import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from './database.js';

export type MessageRole = 'user' | 'model';

export type StoredProfile = {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredConversation = {
  activeAgent: 'tutor';
  practiceModuleId: string | null;
  id: string;
  profileId: string;
  titleUpdatedByUser: boolean;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPracticeModule = {
  archivedAt: string | null;
  id: string;
  isFavorite: boolean;
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

export type StoredPracticeModuleShareLink = {
  practiceModuleId: string;
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

export type StoredMessage = {
  id: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: number;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata: string | null;
  created_at: string;
};

type ConversationRow = {
  active_agent: string;
  practice_module_id: string | null;
  id: string;
  profile_id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type PracticeModuleRow = {
  archived_at: string | null;
  id: string;
  is_favorite: number;
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

type ConversationPracticeModuleSnapshotRow = {
  practice_module_id: string | null;
  conversation_id: string;
  created_at: string;
  description: string;
  title: string;
  tutor_instructions: string;
};

const defaultConversationTitle = 'Nueva conversación';
const defaultProfileName = 'Perfil principal';

function toStoredProfile(row: ProfileRow): StoredProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredConversation(row: ConversationRow): StoredConversation {
  return {
    activeAgent: 'tutor',
    practiceModuleId: row.practice_module_id,
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    titleUpdatedByUser: Boolean(row.title_updated_by_user),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredPracticeModule(row: PracticeModuleRow): StoredPracticeModule {
  return {
    archivedAt: row.archived_at,
    id: row.id,
    isFavorite: Boolean(row.is_favorite),
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

export function createProfile(input: {
  userId: string;
  name: string;
  description?: string;
}): StoredProfile {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO profiles (id, user_id, name, description)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(id, input.userId, input.name, input.description ?? '');

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
        SELECT id, user_id, name, description, created_at, updated_at
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
        SELECT id, user_id, name, description, created_at, updated_at
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
        SELECT id, user_id, name, description, created_at, updated_at
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
    userId,
  });
}

export function updateProfile(input: {
  profileId: string;
  userId: string;
  name: string;
  description: string;
}): StoredProfile | null {
  getDb()
    .prepare(
      `
        UPDATE profiles
        SET name = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(input.name, input.description, input.profileId, input.userId);

  return findProfileForUser(input.profileId, input.userId);
}

export function createConversation(
  userId: string,
  profileId: string,
  title = defaultConversationTitle,
  options: { practiceModuleId?: string | null } = {},
): StoredConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO conversations (id, user_id, profile_id, title, practice_module_id, active_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(id, userId, profileId, title, options.practiceModuleId ?? null, 'tutor');

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

export function findConversationForUser(
  id: string,
  userId: string,
): StoredConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
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

export function listConversationsForProfile(
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
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

export function deleteConversationForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function createPracticeModule(input: {
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
          source_practice_module_id,
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
          id,
          is_favorite,
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
          id,
          is_favorite,
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
          id,
          is_favorite,
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
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
          id,
          is_favorite,
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
