export type Migration = {
  id: number;
  name: string;
  up: string;
};

export const migrations: Migration[] = [
  {
    id: 1,
    name: 'create_current_schema',
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

      CREATE TABLE user_openrouter_keys (
        user_id TEXT PRIMARY KEY,
        key_hash TEXT UNIQUE,
        encrypted_api_key TEXT,
        name TEXT NOT NULL,
        limit_usd REAL,
        limit_reset TEXT CHECK (limit_reset IS NULL OR limit_reset IN ('daily', 'weekly', 'monthly')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disabled')),
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE
      );

      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_profiles_user_created
        ON profiles (user_id, created_at ASC, updated_at ASC);

      CREATE TABLE lessons (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tutor_instructions TEXT NOT NULL,
        source_lesson_id TEXT,
        source_user_id TEXT,
        source_profile_id TEXT,
        shared_via TEXT CHECK (shared_via IS NULL OR shared_via IN ('profile', 'link')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (source_lesson_id)
          REFERENCES lessons (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_lessons_user_profile_updated
        ON lessons (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_lessons_profile_shared
        ON lessons (profile_id, shared_via, updated_at DESC, created_at DESC);

      CREATE INDEX idx_lessons_profile_source
        ON lessons (profile_id, source_lesson_id, shared_via);

      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        active_agent TEXT NOT NULL DEFAULT 'tutor',
        lesson_id TEXT,
        title TEXT NOT NULL DEFAULT 'Nueva conversación',
        title_updated_by_user INTEGER NOT NULL DEFAULT 0 CHECK (title_updated_by_user IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (lesson_id)
          REFERENCES lessons (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_conversations_user_profile_updated
        ON conversations (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_lesson_updated
        ON conversations (lesson_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_active_agent
        ON conversations (active_agent, updated_at DESC, created_at DESC);

      CREATE TABLE conversation_lesson_snapshots (
        conversation_id TEXT PRIMARY KEY,
        lesson_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tutor_instructions TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (lesson_id)
          REFERENCES lessons (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_conversation_lesson_snapshots_lesson
        ON conversation_lesson_snapshots (lesson_id, created_at DESC);

      CREATE TABLE lesson_share_links (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (lesson_id)
          REFERENCES lessons (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_lesson_share_links_active
        ON lesson_share_links (lesson_id, revoked_at, created_at DESC);

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
    name: 'add_conversation_active_agent',
    up: `
        ALTER TABLE conversations
        ADD COLUMN active_agent TEXT NOT NULL DEFAULT 'tutor';

        CREATE INDEX IF NOT EXISTS idx_conversations_active_agent
        ON conversations (active_agent, updated_at DESC, created_at DESC);
      `,
  },
];
