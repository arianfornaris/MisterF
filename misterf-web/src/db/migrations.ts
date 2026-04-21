export type Migration = {
  id: number;
  name: string;
  up: string;
};

export const migrations: Migration[] = [
  {
    id: 1,
    name: 'create_conversations_and_messages',
    up: `
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'model')),
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_messages_conversation_created
        ON messages (conversation_id, created_at, id);
    `,
  },
  {
    id: 2,
    name: 'create_auth_tables',
    up: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        full_name TEXT NOT NULL,
        password_hash TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        disabled_at TEXT
      );

      CREATE TABLE user_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('local', 'google', 'facebook', 'apple')),
        provider_subject TEXT NOT NULL,
        email TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        UNIQUE (provider, provider_subject),
        UNIQUE (user_id, provider)
      );

      CREATE TABLE user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        user_agent TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_user_sessions_token_hash
        ON user_sessions (token_hash);

      CREATE INDEX idx_user_sessions_user_active
        ON user_sessions (user_id, revoked_at, expires_at);
    `,
  },
  {
    id: 3,
    name: 'create_auth_action_tokens',
    up: `
      CREATE TABLE auth_action_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset')),
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_auth_action_tokens_lookup
        ON auth_action_tokens (type, token_hash, used_at, expires_at);

      CREATE INDEX idx_auth_action_tokens_user
        ON auth_action_tokens (user_id, type, used_at);
    `,
  },
  {
    id: 4,
    name: 'add_chat_ownership_and_title',
    up: `
      ALTER TABLE conversations
        ADD COLUMN user_id TEXT
        REFERENCES users (id)
        ON DELETE CASCADE;

      ALTER TABLE conversations
        ADD COLUMN title TEXT NOT NULL DEFAULT 'Nueva conversación';

      CREATE INDEX idx_conversations_user_updated
        ON conversations (user_id, updated_at DESC);
    `,
  },
  {
    id: 5,
    name: 'create_conversation_progress',
    up: `
      CREATE TABLE conversation_progress (
        conversation_id TEXT PRIMARY KEY,
        markdown TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE
      );
    `,
  },
  {
    id: 6,
    name: 'add_manual_conversation_title_flag',
    up: `
      ALTER TABLE conversations
        ADD COLUMN title_updated_by_user INTEGER NOT NULL DEFAULT 0
        CHECK (title_updated_by_user IN (0, 1));
    `,
  },
  {
    id: 7,
    name: 'create_sentence_challenges_and_attempts',
    up: `
      CREATE TABLE sentence_challenges (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        source_sentence TEXT NOT NULL,
        topic TEXT,
        level TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_sentence_challenges_conversation_created
        ON sentence_challenges (conversation_id, created_at, id);

      CREATE TABLE sentence_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        challenge_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        user_message_id INTEGER NOT NULL UNIQUE,
        attempt_text TEXT NOT NULL,
        evaluation_json TEXT NOT NULL,
        is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (challenge_id)
          REFERENCES sentence_challenges (id)
          ON DELETE CASCADE,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_message_id)
          REFERENCES messages (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_sentence_attempts_challenge_created
        ON sentence_attempts (challenge_id, created_at, id);
    `,
  },
  {
    id: 8,
    name: 'add_sentence_challenge_score',
    up: `
      ALTER TABLE sentence_challenges
        ADD COLUMN score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 1));
    `,
  },
  {
    id: 9,
    name: 'create_conversation_vocabulary',
    up: `
      CREATE TABLE conversation_vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        term TEXT NOT NULL COLLATE NOCASE,
        translation TEXT NOT NULL,
        explanation TEXT NOT NULL,
        example TEXT,
        source_sentence TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        UNIQUE (conversation_id, term)
      );

      CREATE INDEX idx_conversation_vocabulary_conversation_created
        ON conversation_vocabulary (conversation_id, created_at, id);
    `,
  },
];
