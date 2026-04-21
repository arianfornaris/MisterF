import { randomUUID } from 'node:crypto';
import { getDb } from './database.js';

export type MessageRole = 'user' | 'model';

export type StoredConversation = {
  id: string;
  titleUpdatedByUser: boolean;
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
  completedAt: string | null;
  conversationId: string;
  createdAt: string;
  id: string;
  level: string | null;
  score: number | null;
  sourceSentence: string;
  topic: string | null;
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
  id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type SentenceChallengeRow = {
  completed_at: string | null;
  conversation_id: string;
  created_at: string;
  id: string;
  level: string | null;
  score: number | null;
  source_sentence: string;
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

const defaultConversationTitle = 'Nueva conversación';

function toStoredConversation(row: ConversationRow): StoredConversation {
  return {
    id: row.id,
    title: row.title,
    titleUpdatedByUser: Boolean(row.title_updated_by_user),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    completedAt: row.completed_at,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    id: row.id,
    level: row.level,
    score: row.score,
    sourceSentence: row.source_sentence,
    topic: row.topic,
  };
}

export function createConversation(
  userId: string,
  title = defaultConversationTitle,
): StoredConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO conversations (id, user_id, title)
        VALUES (?, ?, ?)
      `,
    )
    .run(id, userId, title);

  const conversation = findConversationForUser(id, userId);
  if (!conversation) {
    throw new Error('Could not load newly created conversation.');
  }

  return conversation;
}

export function findConversationForUser(
  id: string,
  userId: string,
): StoredConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at
        FROM conversations
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ConversationRow | undefined;

  return row ? toStoredConversation(row) : null;
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
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at
        FROM conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId) as ConversationRow[];

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
  conversationId: string;
  level?: string | null;
  sourceSentence: string;
  topic?: string | null;
}): StoredSentenceChallenge {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO sentence_challenges (
          id,
          conversation_id,
          source_sentence,
          topic,
          level
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.conversationId,
      input.sourceSentence,
      input.topic || null,
      input.level || null,
    );

  const challenge = findSentenceChallenge(id, input.conversationId);
  if (!challenge) {
    throw new Error('Could not load newly created sentence challenge.');
  }

  return challenge;
}

export function findActiveSentenceChallenge(
  conversationId: string,
): StoredSentenceChallenge | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, conversation_id, source_sentence, topic, level, created_at, completed_at, score
        FROM sentence_challenges
        WHERE conversation_id = ? AND completed_at IS NULL
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
        SELECT id, conversation_id, source_sentence, topic, level, created_at, completed_at, score
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
        SELECT id, conversation_id, source_sentence, topic, level, created_at, completed_at, score
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
