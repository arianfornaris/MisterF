import { randomUUID } from 'node:crypto';
import { getDb } from './database.js';

export type MessageRole = 'user' | 'model';
export type SentenceChallengeType =
  | 'produce_en'
  | 'understand_en'
  | 'dialogue_scene';

export type StoredConversation = {
  activityId: string | null;
  id: string;
  titleUpdatedByUser: boolean;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredActivity = {
  id: string;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredConversationActivitySnapshot = {
  activityId: string;
  conversationId: string;
  createdAt: string;
  description: string;
  title: string;
  tutorInstructions: string;
};

export type StoredAdminChatThread = {
  id: string;
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

export type StoredProgress = {
  conversationId: string;
  markdown: string;
  updatedAt: string;
};

export type SentenceEvaluationPart = {
  explanation?: string;
  status: 'correct' | 'improve' | 'error';
  text: string;
};

export type SentenceEvaluation = {
  parts: SentenceEvaluationPart[];
};

export type StoredSentenceAttempt = {
  id: number;
  attemptText: string;
  challengeId: string;
  conversationId: string;
  createdAt: string;
  evaluation: SentenceEvaluation;
  isCorrect: boolean;
  userMessageId: number;
};

export type StoredSentenceChallenge = {
  attempts: StoredSentenceAttempt[];
  challengeLabel: string;
  challengeType: SentenceChallengeType;
  completedAt: string | null;
  conversationId: string;
  createdAt: string;
  id: string;
  level: string | null;
  objective: string | null;
  score: number | null;
  topic: string | null;
};

export type VocabularyInput = {
  example?: string | null;
  explanation: string;
  sourceSentence?: string | null;
  term: string;
  translation: string;
};

export type StoredVocabularyItem = {
  conversationId: string;
  createdAt: string;
  example: string | null;
  explanation: string;
  id: number;
  sourceSentence: string | null;
  term: string;
  translation: string;
  updatedAt: string;
};

type MessageRow = {
  id: number;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata: string | null;
  created_at: string;
};

type ProgressRow = {
  conversation_id: string;
  markdown: string;
  updated_at: string;
};

type ConversationRow = {
  activity_id: string | null;
  id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  tutor_instructions: string;
  created_at: string;
  updated_at: string;
};

type ConversationActivitySnapshotRow = {
  activity_id: string;
  conversation_id: string;
  created_at: string;
  description: string;
  title: string;
  tutor_instructions: string;
};

type AdminChatThreadRow = {
  id: string;
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

type SentenceChallengeRow = {
  challenge_label: string;
  challenge_type: SentenceChallengeType;
  completed_at: string | null;
  conversation_id: string;
  created_at: string;
  id: string;
  level: string | null;
  objective: string | null;
  score: number | null;
  topic: string | null;
};

type SentenceAttemptRow = {
  attempt_text: string;
  challenge_id: string;
  conversation_id: string;
  created_at: string;
  evaluation_json: string;
  id: number;
  is_correct: number;
  user_message_id: number;
};

type VocabularyRow = {
  conversation_id: string;
  created_at: string;
  example: string | null;
  explanation: string;
  id: number;
  source_sentence: string | null;
  term: string;
  translation: string;
  updated_at: string;
};

type TimestampRow = {
  updated_at: string | null;
};

const defaultConversationTitle = 'Nueva conversación';

function toStoredConversation(row: ConversationRow): StoredConversation {
  return {
    activityId: row.activity_id,
    id: row.id,
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
    userId: row.user_id,
    title: row.title,
    description: row.description,
    tutorInstructions: row.tutor_instructions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function toStoredProgress(row: ProgressRow): StoredProgress {
  return {
    conversationId: row.conversation_id,
    markdown: row.markdown,
    updatedAt: row.updated_at,
  };
}

function toStoredSentenceAttempt(row: SentenceAttemptRow): StoredSentenceAttempt {
  return {
    id: row.id,
    attemptText: row.attempt_text,
    challengeId: row.challenge_id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    evaluation: parseSentenceEvaluation(row.evaluation_json),
    isCorrect: Boolean(row.is_correct),
    userMessageId: row.user_message_id,
  };
}

function toStoredSentenceChallenge(
  row: SentenceChallengeRow,
  attempts: StoredSentenceAttempt[] = [],
): StoredSentenceChallenge {
  return {
    attempts,
    challengeLabel: row.challenge_label,
    challengeType: row.challenge_type,
    completedAt: row.completed_at,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    id: row.id,
    level: row.level,
    objective: row.objective,
    score: row.score,
    topic: row.topic,
  };
}

function toStoredVocabularyItem(row: VocabularyRow): StoredVocabularyItem {
  return {
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    example: row.example,
    explanation: row.explanation,
    id: row.id,
    sourceSentence: row.source_sentence,
    term: row.term,
    translation: row.translation,
    updatedAt: row.updated_at,
  };
}

export function createConversation(
  userId: string,
  title = defaultConversationTitle,
  options: { activityId?: string | null } = {},
): StoredConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO conversations (id, user_id, title, activity_id)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(id, userId, title, options.activityId ?? null);

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
  const conversation = createConversation(userId, defaultConversationTitle, {
    activityId: activity.id,
  });

  createConversationActivitySnapshot(conversation.id, activity);
  return conversation;
}

export function createAdminChatThread(
  userId: string,
  title = 'Admin Chat',
): StoredAdminChatThread {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO admin_chat_threads (id, user_id, title)
        VALUES (?, ?, ?)
      `,
    )
    .run(id, userId, title);

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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, activity_id
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
        SELECT id, user_id, title, created_at, updated_at
        FROM admin_chat_threads
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as AdminChatThreadRow | undefined;

  return row ? toStoredAdminChatThread(row) : null;
}

export function getOrCreateConversation(
  userId: string,
  id?: string | null,
): StoredConversation {
  if (id) {
    const existing = findConversationForUser(id, userId);
    if (existing) {
      return existing;
    }
  }

  return createConversation(userId);
}

export function touchConversation(conversationId: string): void {
  getDb()
    .prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(conversationId);
}

export function listConversationsForUser(userId: string): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, activity_id
        FROM conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function listAdminChatThreadsForUser(
  userId: string,
): StoredAdminChatThread[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, created_at, updated_at
        FROM admin_chat_threads
        WHERE user_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId) as AdminChatThreadRow[];

  return rows.map(toStoredAdminChatThread);
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
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
}): StoredActivity {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO activities (id, user_id, title, description, tutor_instructions)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.userId,
      input.title,
      input.description,
      input.tutorInstructions,
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
        SELECT id, user_id, title, description, tutor_instructions, created_at, updated_at
        FROM activities
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ActivityRow | undefined;

  return row ? toStoredActivity(row) : null;
}

export function listActivitiesForUser(userId: string): StoredActivity[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, description, tutor_instructions, created_at, updated_at
        FROM activities
        WHERE user_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId) as ActivityRow[];

  return rows.map(toStoredActivity);
}

export function listConversationsForActivity(
  activityId: string,
  userId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, activity_id
        FROM conversations
        WHERE user_id = ? AND activity_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, activityId) as ConversationRow[];

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

export function getProgressForConversation(
  conversationId: string,
): StoredProgress | null {
  const row = getDb()
    .prepare(
      `
        SELECT conversation_id, markdown, updated_at
        FROM conversation_progress
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ProgressRow | undefined;

  return row ? toStoredProgress(row) : null;
}

export function upsertProgressForConversation(
  conversationId: string,
  markdown: string,
): StoredProgress {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO conversation_progress (conversation_id, markdown)
      VALUES (?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        markdown = excluded.markdown,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(conversationId, markdown);

  const progress = getProgressForConversation(conversationId);
  if (!progress) {
    throw new Error('Could not load newly saved conversation progress.');
  }

  return progress;
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

export function createSentenceChallenge(input: {
  challengeType?: SentenceChallengeType;
  challengeLabel: string;
  conversationId: string;
  level?: string | null;
  objective?: string | null;
  topic?: string | null;
}): StoredSentenceChallenge {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO sentence_challenges (
          id,
          conversation_id,
          challenge_label,
          challenge_type,
          topic,
          level,
          objective
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.conversationId,
      input.challengeLabel,
      input.challengeType ?? 'produce_en',
      input.topic || null,
      input.level || null,
      input.objective || null,
    );

  const challenge = findSentenceChallenge(id, input.conversationId);
  if (!challenge) {
    throw new Error('Could not load newly created sentence challenge.');
  }

  return challenge;
}

export function findCurrentSentenceChallenge(
  conversationId: string,
): StoredSentenceChallenge | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, conversation_id, challenge_label, challenge_type, topic, level, objective, created_at, completed_at, score
        FROM sentence_challenges
        WHERE conversation_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
    )
    .get(conversationId) as SentenceChallengeRow | undefined;

  return row ? toStoredSentenceChallenge(row, listSentenceAttempts(row.id)) : null;
}

export function findSentenceChallenge(
  id: string,
  conversationId: string,
): StoredSentenceChallenge | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, conversation_id, challenge_label, challenge_type, topic, level, objective, created_at, completed_at, score
        FROM sentence_challenges
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .get(id, conversationId) as SentenceChallengeRow | undefined;

  return row ? toStoredSentenceChallenge(row, listSentenceAttempts(row.id)) : null;
}

export function completeSentenceChallenge(
  id: string,
  conversationId: string,
  score: number | null = null,
): StoredSentenceChallenge | null {
  getDb()
    .prepare(
      `
        UPDATE sentence_challenges
        SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            score = CASE
              WHEN ? IS NULL THEN score
              ELSE ?
            END
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .run(score, score, id, conversationId);

  return findSentenceChallenge(id, conversationId);
}

export function upsertSentenceAttempt(input: {
  attemptText: string;
  challengeId: string;
  conversationId: string;
  evaluation: SentenceEvaluation;
  isCorrect: boolean;
  userMessageId: number;
}): StoredSentenceAttempt {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO sentence_attempts (
        challenge_id,
        conversation_id,
        user_message_id,
        attempt_text,
        evaluation_json,
        is_correct
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_message_id) DO UPDATE SET
        challenge_id = excluded.challenge_id,
        conversation_id = excluded.conversation_id,
        attempt_text = excluded.attempt_text,
        evaluation_json = excluded.evaluation_json,
        is_correct = excluded.is_correct
    `,
  ).run(
    input.challengeId,
    input.conversationId,
    input.userMessageId,
    input.attemptText,
    JSON.stringify(input.evaluation),
    input.isCorrect ? 1 : 0,
  );

  const row = db
    .prepare(
      `
        SELECT id, challenge_id, conversation_id, user_message_id, attempt_text,
               evaluation_json, is_correct, created_at
        FROM sentence_attempts
        WHERE user_message_id = ?
      `,
    )
    .get(input.userMessageId) as SentenceAttemptRow | undefined;

  if (!row) {
    throw new Error('Could not load newly saved sentence attempt.');
  }

  return toStoredSentenceAttempt(row);
}

export function listSentenceAttempts(
  challengeId: string,
): StoredSentenceAttempt[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, challenge_id, conversation_id, user_message_id, attempt_text,
               evaluation_json, is_correct, created_at
        FROM sentence_attempts
        WHERE challenge_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(challengeId) as SentenceAttemptRow[];

  return rows.map(toStoredSentenceAttempt);
}

export function listSentenceChallenges(
  conversationId: string,
): StoredSentenceChallenge[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, conversation_id, challenge_label, challenge_type, topic, level, objective, created_at, completed_at, score
        FROM sentence_challenges
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(conversationId) as SentenceChallengeRow[];

  if (rows.length === 0) {
    return [];
  }

  const attemptsByChallenge = new Map<string, StoredSentenceAttempt[]>();
  for (const row of rows) {
    attemptsByChallenge.set(row.id, []);
  }

  const attemptRows = getDb()
    .prepare(
      `
        SELECT id, challenge_id, conversation_id, user_message_id, attempt_text,
               evaluation_json, is_correct, created_at
        FROM sentence_attempts
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(conversationId) as SentenceAttemptRow[];

  for (const row of attemptRows) {
    attemptsByChallenge.get(row.challenge_id)?.push(toStoredSentenceAttempt(row));
  }

  return rows.map((row) =>
    toStoredSentenceChallenge(row, attemptsByChallenge.get(row.id) ?? []),
  );
}

export function listVocabularyForConversation(
  conversationId: string,
): StoredVocabularyItem[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, conversation_id, term, translation, explanation, example,
               source_sentence, created_at, updated_at
        FROM conversation_vocabulary
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(conversationId) as VocabularyRow[];

  return rows.map(toStoredVocabularyItem);
}

export function getLearningSourceUpdatedAt(
  conversationId: string,
): string | null {
  const row = getDb()
    .prepare(
      `
        SELECT MAX(updated_at) AS updated_at
        FROM (
          SELECT created_at AS updated_at
          FROM sentence_challenges
          WHERE conversation_id = ?

          UNION ALL

          SELECT completed_at AS updated_at
          FROM sentence_challenges
          WHERE conversation_id = ? AND completed_at IS NOT NULL

          UNION ALL

          SELECT created_at AS updated_at
          FROM sentence_attempts
          WHERE conversation_id = ?
        )
      `,
    )
    .get(conversationId, conversationId, conversationId) as
    | TimestampRow
    | undefined;

  return row?.updated_at ?? null;
}

export function getVocabularyUpdatedAt(conversationId: string): string | null {
  const row = getDb()
    .prepare(
      `
        SELECT MAX(updated_at) AS updated_at
        FROM conversation_vocabulary
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as TimestampRow | undefined;

  return row?.updated_at ?? null;
}

export function upsertVocabularyItems(
  conversationId: string,
  items: VocabularyInput[],
): StoredVocabularyItem[] {
  const normalizedItems = items
    .map(normalizeVocabularyInput)
    .filter((item): item is VocabularyInput => Boolean(item));

  if (normalizedItems.length === 0) {
    return listVocabularyForConversation(conversationId);
  }

  const db = getDb();
  const upsert = db.prepare(
    `
      INSERT INTO conversation_vocabulary (
        conversation_id,
        term,
        translation,
        explanation,
        example,
        source_sentence
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id, term) DO UPDATE SET
        translation = excluded.translation,
        explanation = excluded.explanation,
        example = excluded.example,
        source_sentence = excluded.source_sentence,
        updated_at = CURRENT_TIMESTAMP
    `,
  );

  const run = db.transaction(() => {
    for (const item of normalizedItems) {
      upsert.run(
        conversationId,
        item.term,
        item.translation,
        item.explanation,
        item.example || null,
        item.sourceSentence || null,
      );
    }
  });
  run();

  return listVocabularyForConversation(conversationId);
}

function normalizeVocabularyInput(
  item: VocabularyInput,
): VocabularyInput | null {
  const term = normalizeVocabularyText(item.term, 90);
  const translation = normalizeVocabularyText(item.translation, 160);
  const explanation = normalizeVocabularyText(item.explanation, 360);

  if (!term || !translation || !explanation) {
    return null;
  }

  return {
    example: normalizeVocabularyText(item.example ?? '', 240) || null,
    explanation,
    sourceSentence:
      normalizeVocabularyText(item.sourceSentence ?? '', 320) || null,
    term,
    translation,
  };
}

function normalizeVocabularyText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
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

function parseSentenceEvaluation(value: string): SentenceEvaluation {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { parts?: unknown }).parts)
    ) {
      return parsed as SentenceEvaluation;
    }
  } catch {
    // Return an empty evaluation below.
  }

  return { parts: [] };
}
