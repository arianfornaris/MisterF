import { randomUUID } from 'node:crypto';
import { getDb } from './database.js';

export type MessageRole = 'user' | 'model';

export type StoredMessage = {
  id: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata: string | null;
  createdAt: string;
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
  id: string;
};

function toStoredMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function createConversation(): string {
  const id = randomUUID();
  getDb().prepare('INSERT INTO conversations (id) VALUES (?)').run(id);
  return id;
}

export function getOrCreateConversation(id?: string | null): string {
  const db = getDb();

  if (id) {
    const existing = db
      .prepare('SELECT id FROM conversations WHERE id = ?')
      .get(id) as ConversationRow | undefined;

    if (existing) {
      return existing.id;
    }
  }

  return createConversation();
}

export function touchConversation(conversationId: string): void {
  getDb()
    .prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(conversationId);
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
