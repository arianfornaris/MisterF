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
  activeAgent: 'tutor' | 'secretary';
  lessonId: string | null;
  id: string;
  profileId: string;
  titleUpdatedByUser: boolean;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredLesson = {
  id: string;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourceLessonId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredLessonShareLink = {
  lessonId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredConversationLessonSnapshot = {
  lessonId: string | null;
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
  active_agent: 'tutor' | 'secretary';
  lesson_id: string | null;
  id: string;
  profile_id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type LessonRow = {
  id: string;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_lesson_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  user_id: string;
  title: string;
  description: string;
  tutor_instructions: string;
  created_at: string;
  updated_at: string;
};

type LessonShareLinkRow = {
  lesson_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type ConversationLessonSnapshotRow = {
  lesson_id: string | null;
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
    activeAgent: row.active_agent === 'secretary' ? 'secretary' : 'tutor',
    lessonId: row.lesson_id,
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    titleUpdatedByUser: Boolean(row.title_updated_by_user),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredLesson(row: LessonRow): StoredLesson {
  return {
    id: row.id,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourceLessonId: row.source_lesson_id,
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

function toStoredLessonShareLink(
  row: LessonShareLinkRow,
): StoredLessonShareLink {
  return {
    lessonId: row.lesson_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredConversationLessonSnapshot(
  row: ConversationLessonSnapshotRow,
): StoredConversationLessonSnapshot {
  return {
    lessonId: row.lesson_id,
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
  options: { activeAgent?: 'tutor' | 'secretary'; lessonId?: string | null } = {},
): StoredConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO conversations (id, user_id, profile_id, title, lesson_id, active_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(id, userId, profileId, title, options.lessonId ?? null, options.activeAgent ?? 'tutor');

  const conversation = findConversationForUser(id, userId);
  if (!conversation) {
    throw new Error('Could not load newly created conversation.');
  }

  return conversation;
}

export function createConversationFromLesson(
  userId: string,
  lesson: StoredLesson,
): StoredConversation {
  const conversation = createConversation(
    userId,
    lesson.profileId,
    defaultConversationTitle,
    {
      lessonId: lesson.id,
    },
  );

  createConversationLessonSnapshot(conversation.id, lesson);
  return conversation;
}

export function findConversationForUser(
  id: string,
  userId: string,
): StoredConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, lesson_id, profile_id, active_agent
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, lesson_id, profile_id, active_agent
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

export function setConversationActiveAgentForUser(
  id: string,
  userId: string,
  activeAgent: 'tutor' | 'secretary',
): StoredConversation | null {
  getDb()
    .prepare(
      `
        UPDATE conversations
        SET active_agent = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(activeAgent, id, userId);

  return findConversationForUser(id, userId);
}

export function deleteConversationForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function createLesson(input: {
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourceLessonId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
}): StoredLesson {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO lessons (
          id,
          user_id,
          profile_id,
          title,
          description,
          tutor_instructions,
          source_lesson_id,
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
      input.sourceLessonId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

  const lesson = findLessonForUser(id, input.userId);
  if (!lesson) {
    throw new Error('Could not load newly created lesson.');
  }

  return lesson;
}

export function findLessonForUser(
  id: string,
  userId: string,
): StoredLesson | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_lesson_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM lessons
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as LessonRow | undefined;

  return row ? toStoredLesson(row) : null;
}

export function findLessonById(id: string): StoredLesson | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_lesson_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM lessons
        WHERE id = ?
      `,
    )
    .get(id) as LessonRow | undefined;

  return row ? toStoredLesson(row) : null;
}

export function listLessonsForProfile(
  userId: string,
  profileId: string,
): StoredLesson[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_lesson_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM lessons
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as LessonRow[];

  return rows.map(toStoredLesson);
}

export function deleteLessonForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM lessons WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function listConversationsForLesson(
  lessonId: string,
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, lesson_id, profile_id, active_agent
        FROM conversations
        WHERE user_id = ? AND profile_id = ? AND lesson_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId, lessonId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function updateLesson(input: {
  lessonId: string;
  description: string;
  title: string;
  tutorInstructions: string;
  userId: string;
}): StoredLesson | null {
  getDb()
    .prepare(
      `
        UPDATE lessons
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
      input.lessonId,
      input.userId,
    );

  return findLessonForUser(input.lessonId, input.userId);
}

export function findImportedLessonForProfile(input: {
  profileId: string;
  sourceLessonId: string;
  userId: string;
}): StoredLesson | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_lesson_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM lessons
        WHERE user_id = ?
          AND profile_id = ?
          AND source_lesson_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourceLessonId) as
    | LessonRow
    | undefined;

  return row ? toStoredLesson(row) : null;
}

export function importLessonToProfile(input: {
  shareKind: 'profile' | 'link';
  sourceLesson: StoredLesson;
  targetProfileId: string;
  userId: string;
}): StoredLesson {
  const existing = findImportedLessonForProfile({
    profileId: input.targetProfileId,
    sourceLessonId: input.sourceLesson.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  return createLesson({
    description: input.sourceLesson.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourceLessonId: input.sourceLesson.id,
    sourceProfileId: input.sourceLesson.profileId,
    sourceUserId: input.sourceLesson.userId,
    title: input.sourceLesson.title,
    tutorInstructions: input.sourceLesson.tutorInstructions,
    userId: input.userId,
  });
}

export function findLessonShareLinkById(
  id: string,
): StoredLessonShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, lesson_id, created_at, revoked_at
        FROM lesson_share_links
        WHERE id = ?
      `,
    )
    .get(id) as LessonShareLinkRow | undefined;

  return row ? toStoredLessonShareLink(row) : null;
}

export function findLessonShareLinkForLesson(
  lessonId: string,
): StoredLessonShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, lesson_id, created_at, revoked_at
        FROM lesson_share_links
        WHERE lesson_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(lessonId) as LessonShareLinkRow | undefined;

  return row ? toStoredLessonShareLink(row) : null;
}

export function getOrCreateLessonShareLink(
  lessonId: string,
): StoredLessonShareLink {
  const existing = findLessonShareLinkForLesson(lessonId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO lesson_share_links (id, lesson_id)
        VALUES (?, ?)
        ON CONFLICT(lesson_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, lessonId);

  const created = findLessonShareLinkForLesson(lessonId);
  if (!created) {
    throw new Error('Could not load newly created lesson share link.');
  }

  return created;
}

export function createConversationLessonSnapshot(
  conversationId: string,
  lesson: StoredLesson,
): StoredConversationLessonSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_lesson_snapshots (
          conversation_id,
          lesson_id,
          title,
          description,
          tutor_instructions
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      lesson.id,
      lesson.title,
      lesson.description,
      lesson.tutorInstructions,
    );

  const snapshot = getConversationLessonSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation lesson snapshot.');
  }

  return snapshot;
}

export function getConversationLessonSnapshot(
  conversationId: string,
): StoredConversationLessonSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT conversation_id, lesson_id, title, description, tutor_instructions, created_at
        FROM conversation_lesson_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationLessonSnapshotRow | undefined;

  return row ? toStoredConversationLessonSnapshot(row) : null;
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
