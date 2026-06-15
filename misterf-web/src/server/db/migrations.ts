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
        model_tier TEXT NOT NULL DEFAULT 'regular'
          CHECK (model_tier IN ('regular', 'advanced', 'max')),
        learning_context TEXT NOT NULL DEFAULT '',
        profile_onboarding_completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_profiles_user_created
        ON profiles (user_id, created_at ASC, updated_at ASC);

      CREATE TABLE practice_module_collections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
        archived_at TEXT,
        source_collection_id TEXT,
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
        FOREIGN KEY (source_collection_id)
          REFERENCES practice_module_collections (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_practice_module_collections_profile_updated
        ON practice_module_collections (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_module_collections_profile_archive_favorite
        ON practice_module_collections (profile_id, archived_at, is_favorite, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_module_collections_profile_shared
        ON practice_module_collections (profile_id, shared_via, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_module_collections_profile_source
        ON practice_module_collections (profile_id, source_collection_id, shared_via);

      CREATE TABLE practice_modules (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tutor_instructions TEXT NOT NULL,
        collection_id TEXT,
        position_in_collection INTEGER,
        source_practice_module_id TEXT,
        source_user_id TEXT,
        source_profile_id TEXT,
        shared_via TEXT CHECK (shared_via IS NULL OR shared_via IN ('profile', 'link')),
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (collection_id)
          REFERENCES practice_module_collections (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_practice_module_id)
          REFERENCES practice_modules (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_practice_modules_user_profile_updated
        ON practice_modules (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_modules_profile_shared
        ON practice_modules (profile_id, shared_via, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_modules_profile_source
        ON practice_modules (profile_id, source_practice_module_id, shared_via);

      CREATE INDEX idx_practice_modules_profile_archive_favorite
        ON practice_modules (profile_id, archived_at, is_favorite, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_modules_collection_position
        ON practice_modules (collection_id, position_in_collection, updated_at DESC, created_at DESC);

      CREATE TABLE chat_rooms (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source_room_id TEXT,
        source_user_id TEXT,
        source_profile_id TEXT,
        shared_via TEXT CHECK (shared_via IS NULL OR shared_via IN ('profile', 'link')),
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (source_room_id)
          REFERENCES chat_rooms (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_chat_rooms_user_profile_updated
        ON chat_rooms (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_chat_rooms_profile_shared
        ON chat_rooms (profile_id, shared_via, updated_at DESC, created_at DESC);

      CREATE INDEX idx_chat_rooms_profile_source
        ON chat_rooms (profile_id, source_room_id, shared_via);

      CREATE INDEX idx_chat_rooms_profile_archived_updated
        ON chat_rooms (profile_id, archived_at, updated_at DESC, created_at DESC);

      CREATE TABLE chat_room_characters (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        name TEXT NOT NULL,
        short_description TEXT NOT NULL DEFAULT '',
        full_description TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id)
          REFERENCES chat_rooms (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_chat_room_characters_room_position
        ON chat_room_characters (room_id, position ASC, created_at ASC);

      CREATE TABLE chat_room_conversations (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id)
          REFERENCES chat_rooms (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_chat_room_conversations_room_updated
        ON chat_room_conversations (room_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_chat_room_conversations_user_profile_updated
        ON chat_room_conversations (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE TABLE chat_room_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('system', 'user', 'character')),
        sender_name TEXT NOT NULL,
        content TEXT NOT NULL,
        evaluation_status TEXT
          CHECK (evaluation_status IS NULL OR evaluation_status IN ('ok', 'warning')),
        evaluation_problem TEXT,
        evaluation_created_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES chat_room_conversations (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_chat_room_messages_conversation_created
        ON chat_room_messages (conversation_id, created_at ASC, id ASC);

      CREATE TABLE chat_room_conversation_reports (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL UNIQUE,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        summary_title TEXT NOT NULL,
        summary_description TEXT NOT NULL,
        slides_json TEXT NOT NULL,
        practice_module_id TEXT
          REFERENCES practice_modules (id)
          ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES chat_room_conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (room_id)
          REFERENCES chat_rooms (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_chat_room_conversation_reports_room_created
        ON chat_room_conversation_reports (room_id, created_at DESC);

      CREATE INDEX idx_chat_room_conversation_reports_user_profile_created
        ON chat_room_conversation_reports (user_id, profile_id, created_at DESC);

      CREATE TABLE chat_room_share_links (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (room_id)
          REFERENCES chat_rooms (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_chat_room_share_links_room_active
        ON chat_room_share_links (room_id, revoked_at, created_at DESC);

      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        active_agent TEXT NOT NULL DEFAULT 'tutor' CHECK (active_agent IN ('tutor')),
        practice_module_id TEXT,
        chat_room_conversation_report_id TEXT
          REFERENCES chat_room_conversation_reports (id)
          ON DELETE SET NULL,
        model_tier TEXT NOT NULL DEFAULT 'regular'
          CHECK (model_tier IN ('regular', 'advanced', 'max')),
        title TEXT NOT NULL DEFAULT 'Nueva conversación',
        title_updated_by_user INTEGER NOT NULL DEFAULT 0 CHECK (title_updated_by_user IN (0, 1)),
        closed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (practice_module_id)
          REFERENCES practice_modules (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_conversations_user_profile_updated
        ON conversations (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_practice_module_updated
        ON conversations (practice_module_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_active_agent
        ON conversations (active_agent, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_chat_room_report_updated
        ON conversations (chat_room_conversation_report_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_closed_updated
        ON conversations (closed_at, updated_at DESC, created_at DESC);

      CREATE TABLE conversation_practice_module_snapshots (
        conversation_id TEXT PRIMARY KEY,
        practice_module_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tutor_instructions TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (practice_module_id)
          REFERENCES practice_modules (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_conversation_practice_module_snapshots_practice_module
        ON conversation_practice_module_snapshots (practice_module_id, created_at DESC);

      CREATE TABLE conversation_chat_room_report_snapshots (
        conversation_id TEXT PRIMARY KEY,
        chat_room_conversation_report_id TEXT NOT NULL,
        chat_room_conversation_id TEXT NOT NULL,
        room_title TEXT NOT NULL,
        room_description TEXT NOT NULL DEFAULT '',
        report_summary_title TEXT NOT NULL,
        report_summary_description TEXT NOT NULL,
        slides_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (chat_room_conversation_report_id)
          REFERENCES chat_room_conversation_reports (id)
          ON DELETE CASCADE,
        FOREIGN KEY (chat_room_conversation_id)
          REFERENCES chat_room_conversations (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_conversation_chat_room_report_snapshots_report
        ON conversation_chat_room_report_snapshots (chat_room_conversation_report_id, created_at DESC);

      CREATE TABLE tutor_conversation_reports (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        summary_title TEXT NOT NULL,
        summary_description TEXT NOT NULL,
        report_json TEXT NOT NULL,
        practice_module_id TEXT
          REFERENCES practice_modules (id)
          ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_tutor_conversation_reports_user_profile_created
        ON tutor_conversation_reports (user_id, profile_id, created_at DESC);

      CREATE TABLE conversation_tutor_report_snapshots (
        conversation_id TEXT PRIMARY KEY,
        tutor_conversation_report_id TEXT NOT NULL,
        source_conversation_id TEXT NOT NULL,
        report_summary_title TEXT NOT NULL,
        report_summary_description TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (tutor_conversation_report_id)
          REFERENCES tutor_conversation_reports (id)
          ON DELETE CASCADE,
        FOREIGN KEY (source_conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_conversation_tutor_report_snapshots_report
        ON conversation_tutor_report_snapshots (tutor_conversation_report_id, created_at DESC);

      CREATE TABLE conversation_tutor_plans (
        conversation_id TEXT PRIMARY KEY,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE
      );

      CREATE TABLE practice_module_share_links (
        id TEXT PRIMARY KEY,
        practice_module_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (practice_module_id)
          REFERENCES practice_modules (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_practice_module_share_links_active
        ON practice_module_share_links (practice_module_id, revoked_at, created_at DESC);

      CREATE TABLE practice_module_collection_share_links (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (collection_id)
          REFERENCES practice_module_collections (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_practice_module_collection_share_links_active
        ON practice_module_collection_share_links (collection_id, revoked_at, created_at DESC);

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

      CREATE TABLE credit_purchases (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_checkout_session_id TEXT NOT NULL UNIQUE,
        stripe_payment_intent_id TEXT,
        stripe_event_id TEXT,
        package_code TEXT NOT NULL,
        customer_amount_cents INTEGER NOT NULL,
        credited_amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'failed')),
        openrouter_key_hash TEXT,
        remaining_before_usd REAL,
        remaining_after_usd REAL,
        failure_reason TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_credit_purchases_user_created
        ON credit_purchases (user_id, created_at DESC);

      CREATE INDEX idx_credit_purchases_status_updated
        ON credit_purchases (status, updated_at DESC);

      CREATE TABLE learner_progress_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        UNIQUE (user_id, profile_id)
      );

      CREATE INDEX idx_learner_progress_profiles_user_profile
        ON learner_progress_profiles (user_id, profile_id);

      CREATE TABLE learner_progress_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        event_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        UNIQUE (user_id, profile_id, source_type, source_id)
      );

      CREATE INDEX idx_learner_progress_events_profile_date
        ON learner_progress_events (user_id, profile_id, event_date DESC, id DESC);
    `,
  },
];
