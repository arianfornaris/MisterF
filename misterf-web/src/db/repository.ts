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
  activityId: string | null;
  id: string;
  profileId: string;
  titleUpdatedByUser: boolean;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredActivity = {
  id: string;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourceActivityId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredActivityShareLink = {
  activityId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredConversationActivitySnapshot = {
  activityId: string | null;
  conversationId: string;
  createdAt: string;
  description: string;
  title: string;
  tutorInstructions: string;
};

export type StoredAdminChatThread = {
  id: string;
  profileId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAdminChatMessage = {
  id: number;
  threadId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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
  activity_id: string | null;
  id: string;
  profile_id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_activity_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  user_id: string;
  title: string;
  description: string;
  tutor_instructions: string;
  created_at: string;
  updated_at: string;
};

type ActivityShareLinkRow = {
  activity_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type ConversationActivitySnapshotRow = {
  activity_id: string | null;
  conversation_id: string;
  created_at: string;
  description: string;
  title: string;
  tutor_instructions: string;
};

type AdminChatThreadRow = {
  id: string;
  profile_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type AdminChatMessageRow = {
  id: number;
  thread_id: string;
  role: MessageRole;
  content: string;
  metadata: string | null;
  created_at: string;
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
    activityId: row.activity_id,
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    titleUpdatedByUser: Boolean(row.title_updated_by_user),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredActivity(row: ActivityRow): StoredActivity {
  return {
    id: row.id,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourceActivityId: row.source_activity_id,
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

function toStoredActivityShareLink(
  row: ActivityShareLinkRow,
): StoredActivityShareLink {
  return {
    activityId: row.activity_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredConversationActivitySnapshot(
  row: ConversationActivitySnapshotRow,
): StoredConversationActivitySnapshot {
  return {
    activityId: row.activity_id,
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

function toStoredAdminChatThread(row: AdminChatThreadRow): StoredAdminChatThread {
  return {
    id: row.id,
    profileId: row.profile_id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredAdminChatMessage(
  row: AdminChatMessageRow,
): StoredAdminChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
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
  options: { activityId?: string | null } = {},
): StoredConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO conversations (id, user_id, profile_id, title, activity_id)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(id, userId, profileId, title, options.activityId ?? null);

  const conversation = findConversationForUser(id, userId);
  if (!conversation) {
    throw new Error('Could not load newly created conversation.');
  }

  return conversation;
}

export function createConversationFromActivity(
  userId: string,
  activity: StoredActivity,
): StoredConversation {
  const conversation = createConversation(
    userId,
    activity.profileId,
    defaultConversationTitle,
    {
      activityId: activity.id,
    },
  );

  createConversationActivitySnapshot(conversation.id, activity);
  return conversation;
}

export function createAdminChatThread(
  userId: string,
  profileId: string,
  title = 'Admin Chat',
): StoredAdminChatThread {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO admin_chat_threads (id, user_id, profile_id, title)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(id, userId, profileId, title);

  const thread = findAdminChatThreadForUser(id, userId);
  if (!thread) {
    throw new Error('Could not load newly created admin chat thread.');
  }

  return thread;
}

export function findConversationForUser(
  id: string,
  userId: string,
): StoredConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, activity_id, profile_id
        FROM conversations
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ConversationRow | undefined;

  return row ? toStoredConversation(row) : null;
}

export function findAdminChatThreadForUser(
  id: string,
  userId: string,
): StoredAdminChatThread | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, title, created_at, updated_at, profile_id
        FROM admin_chat_threads
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as AdminChatThreadRow | undefined;

  return row ? toStoredAdminChatThread(row) : null;
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, activity_id, profile_id
        FROM conversations
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function listAdminChatThreadsForProfile(
  userId: string,
  profileId: string,
): StoredAdminChatThread[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, created_at, updated_at, profile_id
        FROM admin_chat_threads
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as AdminChatThreadRow[];

  return rows.map(toStoredAdminChatThread);
}

export function renameAdminChatThreadForUser(
  id: string,
  userId: string,
  title: string,
): StoredAdminChatThread | null {
  getDb()
    .prepare(
      `
        UPDATE admin_chat_threads
        SET title = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(title, id, userId);

  return findAdminChatThreadForUser(id, userId);
}

export function deleteAdminChatThreadForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM admin_chat_threads WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
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

export function createActivity(input: {
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourceActivityId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
}): StoredActivity {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO activities (
          id,
          user_id,
          profile_id,
          title,
          description,
          tutor_instructions,
          source_activity_id,
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
      input.sourceActivityId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

  const activity = findActivityForUser(id, input.userId);
  if (!activity) {
    throw new Error('Could not load newly created activity.');
  }

  return activity;
}

export function findActivityForUser(
  id: string,
  userId: string,
): StoredActivity | null {
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
          source_activity_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM activities
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ActivityRow | undefined;

  return row ? toStoredActivity(row) : null;
}

export function findActivityById(id: string): StoredActivity | null {
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
          source_activity_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM activities
        WHERE id = ?
      `,
    )
    .get(id) as ActivityRow | undefined;

  return row ? toStoredActivity(row) : null;
}

export function listActivitiesForProfile(
  userId: string,
  profileId: string,
): StoredActivity[] {
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
          source_activity_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM activities
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as ActivityRow[];

  return rows.map(toStoredActivity);
}

export function deleteActivityForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM activities WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function listConversationsForActivity(
  activityId: string,
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, activity_id, profile_id
        FROM conversations
        WHERE user_id = ? AND profile_id = ? AND activity_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId, activityId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function updateActivity(input: {
  activityId: string;
  description: string;
  title: string;
  tutorInstructions: string;
  userId: string;
}): StoredActivity | null {
  getDb()
    .prepare(
      `
        UPDATE activities
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
      input.activityId,
      input.userId,
    );

  return findActivityForUser(input.activityId, input.userId);
}

export function findImportedActivityForProfile(input: {
  profileId: string;
  sourceActivityId: string;
  userId: string;
}): StoredActivity | null {
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
          source_activity_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM activities
        WHERE user_id = ?
          AND profile_id = ?
          AND source_activity_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourceActivityId) as
    | ActivityRow
    | undefined;

  return row ? toStoredActivity(row) : null;
}

export function importActivityToProfile(input: {
  shareKind: 'profile' | 'link';
  sourceActivity: StoredActivity;
  targetProfileId: string;
  userId: string;
}): StoredActivity {
  const existing = findImportedActivityForProfile({
    profileId: input.targetProfileId,
    sourceActivityId: input.sourceActivity.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  return createActivity({
    description: input.sourceActivity.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourceActivityId: input.sourceActivity.id,
    sourceProfileId: input.sourceActivity.profileId,
    sourceUserId: input.sourceActivity.userId,
    title: input.sourceActivity.title,
    tutorInstructions: input.sourceActivity.tutorInstructions,
    userId: input.userId,
  });
}

export function findActivityShareLinkById(
  id: string,
): StoredActivityShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, activity_id, created_at, revoked_at
        FROM activity_share_links
        WHERE id = ?
      `,
    )
    .get(id) as ActivityShareLinkRow | undefined;

  return row ? toStoredActivityShareLink(row) : null;
}

export function findActivityShareLinkForActivity(
  activityId: string,
): StoredActivityShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, activity_id, created_at, revoked_at
        FROM activity_share_links
        WHERE activity_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(activityId) as ActivityShareLinkRow | undefined;

  return row ? toStoredActivityShareLink(row) : null;
}

export function getOrCreateActivityShareLink(
  activityId: string,
): StoredActivityShareLink {
  const existing = findActivityShareLinkForActivity(activityId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO activity_share_links (id, activity_id)
        VALUES (?, ?)
        ON CONFLICT(activity_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, activityId);

  const created = findActivityShareLinkForActivity(activityId);
  if (!created) {
    throw new Error('Could not load newly created activity share link.');
  }

  return created;
}

export function createConversationActivitySnapshot(
  conversationId: string,
  activity: StoredActivity,
): StoredConversationActivitySnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_activity_snapshots (
          conversation_id,
          activity_id,
          title,
          description,
          tutor_instructions
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      activity.id,
      activity.title,
      activity.description,
      activity.tutorInstructions,
    );

  const snapshot = getConversationActivitySnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation activity snapshot.');
  }

  return snapshot;
}

export function getConversationActivitySnapshot(
  conversationId: string,
): StoredConversationActivitySnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT conversation_id, activity_id, title, description, tutor_instructions, created_at
        FROM conversation_activity_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationActivitySnapshotRow | undefined;

  return row ? toStoredConversationActivitySnapshot(row) : null;
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

export function listAdminChatMessages(
  threadId: string,
): StoredAdminChatMessage[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, thread_id, role, content, metadata, created_at
        FROM admin_chat_messages
        WHERE thread_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(threadId) as AdminChatMessageRow[];

  return rows.map(toStoredAdminChatMessage);
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

export function addAdminChatMessage(
  threadId: string,
  role: MessageRole,
  content: string,
  metadata: Record<string, unknown> | null = null,
): StoredAdminChatMessage {
  const db = getDb();
  const result = db
    .prepare(
      `
        INSERT INTO admin_chat_messages (thread_id, role, content, metadata)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(
      threadId,
      role,
      content,
      metadata ? JSON.stringify(metadata) : null,
    );

  db.prepare(
    `
      UPDATE admin_chat_threads
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId);

  const row = db
    .prepare(
      `
        SELECT id, thread_id, role, content, metadata, created_at
        FROM admin_chat_messages
        WHERE id = ?
      `,
    )
    .get(result.lastInsertRowid) as AdminChatMessageRow;

  return toStoredAdminChatMessage(row);
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
