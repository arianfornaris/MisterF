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

      CREATE TABLE practice_guides (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tutor_instructions TEXT NOT NULL,
        source_practice_guide_id TEXT,
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
        FOREIGN KEY (source_practice_guide_id)
          REFERENCES practice_guides (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_practice_guides_user_profile_updated
        ON practice_guides (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_guides_profile_shared
        ON practice_guides (profile_id, shared_via, updated_at DESC, created_at DESC);

      CREATE INDEX idx_practice_guides_profile_source
        ON practice_guides (profile_id, source_practice_guide_id, shared_via);

      CREATE INDEX idx_practice_guides_profile_archived_updated
        ON practice_guides (profile_id, archived_at, updated_at DESC, created_at DESC);

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
        practice_guide_id TEXT
          REFERENCES practice_guides (id)
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
        practice_guide_id TEXT,
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
        FOREIGN KEY (practice_guide_id)
          REFERENCES practice_guides (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_conversations_user_profile_updated
        ON conversations (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_practice_guide_updated
        ON conversations (practice_guide_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_active_agent
        ON conversations (active_agent, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_chat_room_report_updated
        ON conversations (chat_room_conversation_report_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_conversations_closed_updated
        ON conversations (closed_at, updated_at DESC, created_at DESC);

      CREATE TABLE conversation_practice_guide_snapshots (
        conversation_id TEXT PRIMARY KEY,
        practice_guide_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tutor_instructions TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (practice_guide_id)
          REFERENCES practice_guides (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_conversation_practice_guide_snapshots_practice_guide
        ON conversation_practice_guide_snapshots (practice_guide_id, created_at DESC);

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
        practice_guide_id TEXT
          REFERENCES practice_guides (id)
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

      CREATE TABLE practice_guide_share_links (
        id TEXT PRIMARY KEY,
        practice_guide_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (practice_guide_id)
          REFERENCES practice_guides (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_practice_guide_share_links_active
        ON practice_guide_share_links (practice_guide_id, revoked_at, created_at DESC);

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
  {
    id: 2,
    name: 'add_teacher_assigned_practice',
    up: `
      CREATE TABLE quizzes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        target_topic TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '',
        estimated_minutes INTEGER,
        instructions TEXT NOT NULL DEFAULT '',
        rubric TEXT NOT NULL DEFAULT '',
        quiz_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        archived_at TEXT,
        source_quiz_id TEXT,
        source_user_id TEXT,
        source_profile_id TEXT,
        shared_via TEXT CHECK (shared_via IS NULL OR shared_via IN ('profile', 'link')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (source_quiz_id)
          REFERENCES quizzes (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_quizzes_user_profile_updated
        ON quizzes (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_quizzes_profile_archived_updated
        ON quizzes (profile_id, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_quizzes_profile_source
        ON quizzes (profile_id, source_quiz_id, shared_via);

      CREATE TABLE quiz_authoring_sessions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN ('drafting', 'published', 'discarded')),
        initial_prompt TEXT NOT NULL DEFAULT '',
        messages_json TEXT NOT NULL DEFAULT '[]',
        current_draft_json TEXT NOT NULL,
        last_validated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id)
          REFERENCES quizzes (id)
          ON DELETE SET NULL,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_quiz_authoring_sessions_user_profile_updated
        ON quiz_authoring_sessions (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_quiz_authoring_sessions_quiz
        ON quiz_authoring_sessions (quiz_id, updated_at DESC);

      CREATE TABLE quiz_authoring_revisions (
        id TEXT PRIMARY KEY,
        authoring_session_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('assistant', 'manual', 'block_add', 'block_revision', 'preview_test')),
        user_message TEXT,
        assistant_message TEXT,
        draft_json TEXT NOT NULL,
        validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'invalid')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (authoring_session_id)
          REFERENCES quiz_authoring_sessions (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_quiz_authoring_revisions_session_created
        ON quiz_authoring_revisions (authoring_session_id, created_at ASC);

      CREATE TABLE quiz_share_links (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (quiz_id)
          REFERENCES quizzes (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_quiz_share_links_quiz_active
        ON quiz_share_links (quiz_id, revoked_at, created_at DESC);

      CREATE TABLE quiz_attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        user_id TEXT,
        profile_id TEXT,
        guest_token TEXT UNIQUE,
        claim_token TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'evaluating', 'evaluated', 'failed')),
        snapshot_json TEXT NOT NULL,
        responses_json TEXT NOT NULL DEFAULT '[]',
        result_json TEXT,
        progress_event_id INTEGER,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at TEXT,
        evaluated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id)
          REFERENCES quizzes (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL,
        FOREIGN KEY (progress_event_id)
          REFERENCES learner_progress_events (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_quiz_attempts_quiz_created
        ON quiz_attempts (quiz_id, created_at DESC);

      CREATE INDEX idx_quiz_attempts_user_profile_created
        ON quiz_attempts (user_id, profile_id, created_at DESC);

      CREATE INDEX idx_quiz_attempts_guest_token
        ON quiz_attempts (guest_token);

      CREATE INDEX idx_quiz_attempts_claim_token
        ON quiz_attempts (claim_token);

      CREATE TABLE conversation_quiz_attempt_snapshots (
        conversation_id TEXT PRIMARY KEY,
        quiz_attempt_id TEXT NOT NULL,
        quiz_title TEXT NOT NULL,
        quiz_description TEXT NOT NULL DEFAULT '',
        quiz_target_topic TEXT NOT NULL DEFAULT '',
        quiz_snapshot_json TEXT NOT NULL,
        responses_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (quiz_attempt_id)
          REFERENCES quiz_attempts (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_conversation_quiz_attempt_snapshots_attempt
        ON conversation_quiz_attempt_snapshots (quiz_attempt_id, created_at DESC);
    `,
  },
  {
    id: 3,
    name: 'simplify_quiz_lifecycle',
    up: `
      PRAGMA defer_foreign_keys = ON;

      ALTER TABLE quizzes DROP COLUMN status;
      ALTER TABLE quizzes DROP COLUMN published_at;

      ALTER TABLE quiz_authoring_sessions
        RENAME TO quiz_authoring_sessions_old;

      DROP INDEX IF EXISTS idx_quiz_authoring_sessions_user_profile_updated;
      DROP INDEX IF EXISTS idx_quiz_authoring_sessions_quiz;

      CREATE TABLE quiz_authoring_sessions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN ('drafting', 'saved', 'discarded')),
        initial_prompt TEXT NOT NULL DEFAULT '',
        messages_json TEXT NOT NULL DEFAULT '[]',
        current_draft_json TEXT NOT NULL,
        last_validated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id)
          REFERENCES quizzes (id)
          ON DELETE SET NULL,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE
      );

      INSERT INTO quiz_authoring_sessions (
        id,
        quiz_id,
        user_id,
        profile_id,
        status,
        initial_prompt,
        messages_json,
        current_draft_json,
        last_validated_at,
        created_at,
        updated_at
      )
      SELECT
        id,
        quiz_id,
        user_id,
        profile_id,
        CASE status
          WHEN 'published' THEN 'saved'
          ELSE status
        END,
        initial_prompt,
        messages_json,
        current_draft_json,
        last_validated_at,
        created_at,
        updated_at
      FROM quiz_authoring_sessions_old;

      CREATE INDEX idx_quiz_authoring_sessions_user_profile_updated
        ON quiz_authoring_sessions (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_quiz_authoring_sessions_quiz
        ON quiz_authoring_sessions (quiz_id, updated_at DESC);

      ALTER TABLE quiz_authoring_revisions
        RENAME TO quiz_authoring_revisions_old;

      DROP INDEX IF EXISTS idx_quiz_authoring_revisions_session_created;

      CREATE TABLE quiz_authoring_revisions (
        id TEXT PRIMARY KEY,
        authoring_session_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('assistant', 'manual', 'block_add', 'block_revision', 'preview_test')),
        user_message TEXT,
        assistant_message TEXT,
        draft_json TEXT NOT NULL,
        validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'invalid')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (authoring_session_id)
          REFERENCES quiz_authoring_sessions (id)
          ON DELETE CASCADE
      );

      INSERT INTO quiz_authoring_revisions (
        id,
        authoring_session_id,
        source,
        user_message,
        assistant_message,
        draft_json,
        validation_status,
        created_at
      )
      SELECT
        id,
        authoring_session_id,
        source,
        user_message,
        assistant_message,
        draft_json,
        validation_status,
        created_at
      FROM quiz_authoring_revisions_old;

      CREATE INDEX idx_quiz_authoring_revisions_session_created
        ON quiz_authoring_revisions (authoring_session_id, created_at ASC);

      ALTER TABLE quiz_attempts
        RENAME TO quiz_attempts_old;

      DROP INDEX IF EXISTS idx_quiz_attempts_quiz_created;
      DROP INDEX IF EXISTS idx_quiz_attempts_user_profile_created;
      DROP INDEX IF EXISTS idx_quiz_attempts_guest_token;
      DROP INDEX IF EXISTS idx_quiz_attempts_claim_token;

      CREATE TABLE quiz_attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT,
        authoring_session_id TEXT,
        user_id TEXT,
        profile_id TEXT,
        guest_token TEXT UNIQUE,
        claim_token TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'evaluating', 'evaluated', 'failed')),
        snapshot_json TEXT NOT NULL,
        responses_json TEXT NOT NULL DEFAULT '[]',
        result_json TEXT,
        progress_event_id INTEGER,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at TEXT,
        evaluated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (quiz_id IS NOT NULL OR authoring_session_id IS NOT NULL),
        FOREIGN KEY (quiz_id)
          REFERENCES quizzes (id)
          ON DELETE CASCADE,
        FOREIGN KEY (authoring_session_id)
          REFERENCES quiz_authoring_sessions (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL,
        FOREIGN KEY (progress_event_id)
          REFERENCES learner_progress_events (id)
          ON DELETE SET NULL
      );

      INSERT INTO quiz_attempts (
        id,
        quiz_id,
        authoring_session_id,
        user_id,
        profile_id,
        guest_token,
        claim_token,
        status,
        snapshot_json,
        responses_json,
        result_json,
        progress_event_id,
        started_at,
        submitted_at,
        evaluated_at,
        created_at,
        updated_at
      )
      SELECT
        id,
        quiz_id,
        NULL,
        user_id,
        profile_id,
        guest_token,
        claim_token,
        status,
        snapshot_json,
        responses_json,
        result_json,
        progress_event_id,
        started_at,
        submitted_at,
        evaluated_at,
        created_at,
        updated_at
      FROM quiz_attempts_old;

      CREATE INDEX idx_quiz_attempts_quiz_created
        ON quiz_attempts (quiz_id, created_at DESC);

      CREATE INDEX idx_quiz_attempts_authoring_session_created
        ON quiz_attempts (authoring_session_id, created_at DESC);

      CREATE INDEX idx_quiz_attempts_user_profile_created
        ON quiz_attempts (user_id, profile_id, created_at DESC);

      CREATE INDEX idx_quiz_attempts_guest_token
        ON quiz_attempts (guest_token);

      CREATE INDEX idx_quiz_attempts_claim_token
        ON quiz_attempts (claim_token);

      ALTER TABLE conversation_quiz_attempt_snapshots
        RENAME TO conversation_quiz_attempt_snapshots_old;

      DROP INDEX IF EXISTS idx_conversation_quiz_attempt_snapshots_attempt;

      CREATE TABLE conversation_quiz_attempt_snapshots (
        conversation_id TEXT PRIMARY KEY,
        quiz_attempt_id TEXT NOT NULL,
        quiz_title TEXT NOT NULL,
        quiz_description TEXT NOT NULL DEFAULT '',
        quiz_target_topic TEXT NOT NULL DEFAULT '',
        quiz_snapshot_json TEXT NOT NULL,
        responses_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (quiz_attempt_id)
          REFERENCES quiz_attempts (id)
          ON DELETE CASCADE
      );

      INSERT INTO conversation_quiz_attempt_snapshots (
        conversation_id,
        quiz_attempt_id,
        quiz_title,
        quiz_description,
        quiz_target_topic,
        quiz_snapshot_json,
        responses_json,
        result_json,
        created_at
      )
      SELECT
        conversation_id,
        quiz_attempt_id,
        quiz_title,
        quiz_description,
        quiz_target_topic,
        quiz_snapshot_json,
        responses_json,
        result_json,
        created_at
      FROM conversation_quiz_attempt_snapshots_old;

      CREATE INDEX idx_conversation_quiz_attempt_snapshots_attempt
        ON conversation_quiz_attempt_snapshots (quiz_attempt_id, created_at DESC);

      DROP TABLE conversation_quiz_attempt_snapshots_old;
      DROP TABLE quiz_attempts_old;
      DROP TABLE quiz_authoring_revisions_old;
      DROP TABLE quiz_authoring_sessions_old;
    `,
  },
  {
    id: 4,
    name: 'remove_quiz_authoring_revisions',
    up: `
      DROP INDEX IF EXISTS idx_quiz_authoring_revisions_session_created;
      DROP TABLE IF EXISTS quiz_authoring_revisions;
    `,
  },
  {
    id: 5,
    name: 'remove_quiz_authoring_sessions',
    up: `
      PRAGMA defer_foreign_keys = ON;

      INSERT INTO quizzes (
        id,
        user_id,
        profile_id,
        title,
        description,
        target_topic,
        level,
        estimated_minutes,
        instructions,
        rubric,
        quiz_json,
        created_at,
        updated_at
      )
      SELECT
        session.id,
        session.user_id,
        session.profile_id,
        CASE
          WHEN json_valid(session.current_draft_json)
            THEN COALESCE(NULLIF(json_extract(session.current_draft_json, '$.title'), ''), NULLIF(session.initial_prompt, ''), 'Imported quiz')
          ELSE COALESCE(NULLIF(session.initial_prompt, ''), 'Imported quiz')
        END,
        CASE
          WHEN json_valid(session.current_draft_json)
            THEN COALESCE(json_extract(session.current_draft_json, '$.description'), '')
          ELSE ''
        END,
        CASE
          WHEN json_valid(session.current_draft_json)
            THEN COALESCE(json_extract(session.current_draft_json, '$.targetTopic'), '')
          ELSE ''
        END,
        CASE
          WHEN json_valid(session.current_draft_json)
            THEN COALESCE(json_extract(session.current_draft_json, '$.level'), '')
          ELSE ''
        END,
        CASE
          WHEN json_valid(session.current_draft_json)
            THEN json_extract(session.current_draft_json, '$.estimatedMinutes')
          ELSE NULL
        END,
        CASE
          WHEN json_valid(session.current_draft_json)
            THEN COALESCE(json_extract(session.current_draft_json, '$.instructions'), '')
          ELSE ''
        END,
        CASE
          WHEN json_valid(session.current_draft_json)
            THEN COALESCE(json_extract(session.current_draft_json, '$.rubric'), '')
          ELSE ''
        END,
        session.current_draft_json,
        session.created_at,
        session.updated_at
      FROM quiz_authoring_sessions AS session
      WHERE session.quiz_id IS NULL
        AND session.status <> 'discarded'
        AND NOT EXISTS (
          SELECT 1
          FROM quizzes
          WHERE quizzes.id = session.id
        );

      ALTER TABLE quiz_attempts
        RENAME TO quiz_attempts_old;

      DROP INDEX IF EXISTS idx_quiz_attempts_quiz_created;
      DROP INDEX IF EXISTS idx_quiz_attempts_authoring_session_created;
      DROP INDEX IF EXISTS idx_quiz_attempts_user_profile_created;
      DROP INDEX IF EXISTS idx_quiz_attempts_guest_token;
      DROP INDEX IF EXISTS idx_quiz_attempts_claim_token;

      CREATE TABLE quiz_attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        user_id TEXT,
        profile_id TEXT,
        guest_token TEXT UNIQUE,
        claim_token TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'evaluating', 'evaluated', 'failed')),
        snapshot_json TEXT NOT NULL,
        responses_json TEXT NOT NULL DEFAULT '[]',
        result_json TEXT,
        progress_event_id INTEGER,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at TEXT,
        evaluated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id)
          REFERENCES quizzes (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL,
        FOREIGN KEY (progress_event_id)
          REFERENCES learner_progress_events (id)
          ON DELETE SET NULL
      );

      INSERT INTO quiz_attempts (
        id,
        quiz_id,
        user_id,
        profile_id,
        guest_token,
        claim_token,
        status,
        snapshot_json,
        responses_json,
        result_json,
        progress_event_id,
        started_at,
        submitted_at,
        evaluated_at,
        created_at,
        updated_at
      )
      SELECT
        attempt.id,
        COALESCE(attempt.quiz_id, session.quiz_id, attempt.authoring_session_id),
        attempt.user_id,
        attempt.profile_id,
        attempt.guest_token,
        attempt.claim_token,
        attempt.status,
        attempt.snapshot_json,
        attempt.responses_json,
        attempt.result_json,
        attempt.progress_event_id,
        attempt.started_at,
        attempt.submitted_at,
        attempt.evaluated_at,
        attempt.created_at,
        attempt.updated_at
      FROM quiz_attempts_old AS attempt
      LEFT JOIN quiz_authoring_sessions AS session
        ON session.id = attempt.authoring_session_id
      WHERE EXISTS (
        SELECT 1
        FROM quizzes
        WHERE quizzes.id = COALESCE(attempt.quiz_id, session.quiz_id, attempt.authoring_session_id)
      );

      CREATE INDEX idx_quiz_attempts_quiz_created
        ON quiz_attempts (quiz_id, created_at DESC);

      CREATE INDEX idx_quiz_attempts_user_profile_created
        ON quiz_attempts (user_id, profile_id, created_at DESC);

      CREATE INDEX idx_quiz_attempts_guest_token
        ON quiz_attempts (guest_token);

      CREATE INDEX idx_quiz_attempts_claim_token
        ON quiz_attempts (claim_token);

      ALTER TABLE conversation_quiz_attempt_snapshots
        RENAME TO conversation_quiz_attempt_snapshots_old;

      DROP INDEX IF EXISTS idx_conversation_quiz_attempt_snapshots_attempt;

      CREATE TABLE conversation_quiz_attempt_snapshots (
        conversation_id TEXT PRIMARY KEY,
        quiz_attempt_id TEXT NOT NULL,
        quiz_title TEXT NOT NULL,
        quiz_description TEXT NOT NULL DEFAULT '',
        quiz_target_topic TEXT NOT NULL DEFAULT '',
        quiz_snapshot_json TEXT NOT NULL,
        responses_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (quiz_attempt_id)
          REFERENCES quiz_attempts (id)
          ON DELETE CASCADE
      );

      INSERT INTO conversation_quiz_attempt_snapshots (
        conversation_id,
        quiz_attempt_id,
        quiz_title,
        quiz_description,
        quiz_target_topic,
        quiz_snapshot_json,
        responses_json,
        result_json,
        created_at
      )
      SELECT
        snapshot.conversation_id,
        snapshot.quiz_attempt_id,
        snapshot.quiz_title,
        snapshot.quiz_description,
        snapshot.quiz_target_topic,
        snapshot.quiz_snapshot_json,
        snapshot.responses_json,
        snapshot.result_json,
        snapshot.created_at
      FROM conversation_quiz_attempt_snapshots_old AS snapshot
      WHERE EXISTS (
        SELECT 1
        FROM quiz_attempts
        WHERE quiz_attempts.id = snapshot.quiz_attempt_id
      );

      CREATE INDEX idx_conversation_quiz_attempt_snapshots_attempt
        ON conversation_quiz_attempt_snapshots (quiz_attempt_id, created_at DESC);

      DROP TABLE conversation_quiz_attempt_snapshots_old;
      DROP TABLE quiz_attempts_old;
      DROP INDEX IF EXISTS idx_quiz_authoring_sessions_user_profile_updated;
      DROP INDEX IF EXISTS idx_quiz_authoring_sessions_quiz;
      DROP TABLE IF EXISTS quiz_authoring_sessions;
    `,
  },
  {
    id: 6,
    name: 'drop_quiz_estimated_minutes',
    up: `
      ALTER TABLE quizzes
        DROP COLUMN estimated_minutes;
    `,
  },
  {
    id: 7,
    name: 'drop_quiz_rubric',
    up: `
      ALTER TABLE quizzes
        DROP COLUMN rubric;
    `,
  },
  {
    id: 8,
    name: 'add_quiz_authoring_messages',
    up: `
      ALTER TABLE quizzes
        ADD COLUMN authoring_messages_json TEXT NOT NULL DEFAULT '[]';
    `,
  },
  {
    id: 9,
    name: 'add_resource_foundation',
    up: `
      CREATE TABLE resources (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('quiz', 'practice_guide', 'resource_folder')),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '',
        archived_at TEXT,
        source_resource_id TEXT,
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
        FOREIGN KEY (source_resource_id)
          REFERENCES resources (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX idx_resources_id_type
        ON resources (id, type);

      CREATE INDEX idx_resources_user_profile_updated
        ON resources (user_id, profile_id, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_resources_profile_type_updated
        ON resources (profile_id, type, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_resources_profile_archived_updated
        ON resources (profile_id, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_resources_profile_source
        ON resources (profile_id, source_resource_id, shared_via);

      CREATE TABLE resource_folders (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id)
          REFERENCES resources (id)
          ON DELETE CASCADE
      );

      CREATE TABLE resource_folder_items (
        folder_id TEXT NOT NULL,
        resource_id TEXT NOT NULL UNIQUE,
        resource_type TEXT NOT NULL CHECK (resource_type IN ('quiz', 'practice_guide')),
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (folder_id, resource_id),
        FOREIGN KEY (folder_id)
          REFERENCES resource_folders (id)
          ON DELETE CASCADE,
        FOREIGN KEY (resource_id, resource_type)
          REFERENCES resources (id, type)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_resource_folder_items_folder_position
        ON resource_folder_items (folder_id, position ASC, created_at ASC);

      CREATE TABLE resource_share_links (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (resource_id)
          REFERENCES resources (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_resource_share_links_resource_active
        ON resource_share_links (resource_id, revoked_at, created_at DESC);

      INSERT INTO resources (
        id,
        user_id,
        profile_id,
        type,
        title,
        description,
        topic,
        level,
        archived_at,
        source_user_id,
        source_profile_id,
        shared_via,
        created_at,
        updated_at
      )
      SELECT
        id,
        user_id,
        profile_id,
        'quiz',
        title,
        description,
        target_topic,
        level,
        archived_at,
        source_user_id,
        source_profile_id,
        shared_via,
        created_at,
        updated_at
      FROM quizzes;

      INSERT INTO resources (
        id,
        user_id,
        profile_id,
        type,
        title,
        description,
        archived_at,
        source_user_id,
        source_profile_id,
        shared_via,
        created_at,
        updated_at
      )
      SELECT
        id,
        user_id,
        profile_id,
        'practice_guide',
        title,
        description,
        archived_at,
        source_user_id,
        source_profile_id,
        shared_via,
        created_at,
        updated_at
      FROM practice_guides;

      UPDATE resources
      SET source_resource_id = (
        SELECT source_quiz_id
        FROM quizzes
        WHERE quizzes.id = resources.id
      )
      WHERE type = 'quiz'
        AND EXISTS (
          SELECT 1
          FROM quizzes
          JOIN resources AS source_resource
            ON source_resource.id = quizzes.source_quiz_id
          WHERE quizzes.id = resources.id
        );

      UPDATE resources
      SET source_resource_id = (
        SELECT source_practice_guide_id
        FROM practice_guides
        WHERE practice_guides.id = resources.id
      )
      WHERE type = 'practice_guide'
        AND EXISTS (
          SELECT 1
          FROM practice_guides
          JOIN resources AS source_resource
            ON source_resource.id = practice_guides.source_practice_guide_id
          WHERE practice_guides.id = resources.id
        );

      INSERT INTO resource_folders (id, created_at, updated_at)
      SELECT id, created_at, updated_at
      FROM resources
      WHERE type = 'resource_folder';

      INSERT INTO resource_share_links (id, resource_id, created_at, revoked_at)
      SELECT id, quiz_id, created_at, revoked_at
      FROM quiz_share_links
      WHERE EXISTS (
        SELECT 1
        FROM resources
        WHERE resources.id = quiz_share_links.quiz_id
      );

      INSERT OR IGNORE INTO resource_share_links (id, resource_id, created_at, revoked_at)
      SELECT id, practice_guide_id, created_at, revoked_at
      FROM practice_guide_share_links
      WHERE EXISTS (
        SELECT 1
        FROM resources
        WHERE resources.id = practice_guide_share_links.practice_guide_id
      );

    `,
  },
  {
    id: 10,
    name: 'allow_nested_resource_folders',
    up: `
      PRAGMA defer_foreign_keys = ON;

      CREATE TABLE resource_folder_items_next (
        folder_id TEXT NOT NULL,
        resource_id TEXT NOT NULL UNIQUE,
        resource_type TEXT NOT NULL CHECK (resource_type IN ('quiz', 'practice_guide', 'resource_folder')),
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (folder_id, resource_id),
        FOREIGN KEY (folder_id)
          REFERENCES resource_folders (id)
          ON DELETE CASCADE,
        FOREIGN KEY (resource_id, resource_type)
          REFERENCES resources (id, type)
          ON DELETE CASCADE
      );

      INSERT INTO resource_folder_items_next (
        folder_id,
        resource_id,
        resource_type,
        position,
        created_at,
        updated_at
      )
      SELECT
        folder_id,
        resource_id,
        resource_type,
        position,
        created_at,
        updated_at
      FROM resource_folder_items;

      DROP TABLE resource_folder_items;

      ALTER TABLE resource_folder_items_next
        RENAME TO resource_folder_items;

      CREATE INDEX idx_resource_folder_items_folder_position
        ON resource_folder_items (folder_id, position ASC, created_at ASC);
    `,
  },
  {
    id: 11,
    name: 'add_live_resource_access_grants',
    up: `
      CREATE TABLE resource_access_grants (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        granted_by_user_id TEXT NOT NULL,
        granted_via TEXT NOT NULL CHECK (granted_via IN ('profile', 'link')),
        share_link_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (resource_id)
          REFERENCES resources (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (granted_by_user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (share_link_id)
          REFERENCES resource_share_links (id)
          ON DELETE SET NULL,
        UNIQUE (resource_id, user_id, profile_id)
      );

      CREATE INDEX idx_resource_access_grants_profile_active
        ON resource_access_grants (user_id, profile_id, revoked_at, created_at DESC);

      CREATE INDEX idx_resource_access_grants_resource_active
        ON resource_access_grants (resource_id, revoked_at, created_at DESC);
    `,
  },
  {
    id: 12,
    name: 'add_roleplay_resources',
    up: `
      PRAGMA defer_foreign_keys = ON;

      ALTER TABLE resource_access_grants
        RENAME TO resource_access_grants_old;

      DROP INDEX IF EXISTS idx_resource_access_grants_profile_active;
      DROP INDEX IF EXISTS idx_resource_access_grants_resource_active;

      ALTER TABLE resource_share_links
        RENAME TO resource_share_links_old;

      DROP INDEX IF EXISTS idx_resource_share_links_resource_active;

      ALTER TABLE resource_folder_items
        RENAME TO resource_folder_items_old;

      DROP INDEX IF EXISTS idx_resource_folder_items_folder_position;

      ALTER TABLE resource_folders
        RENAME TO resource_folders_old;

      ALTER TABLE resources
        RENAME TO resources_old;

      DROP INDEX IF EXISTS idx_resources_id_type;
      DROP INDEX IF EXISTS idx_resources_user_profile_updated;
      DROP INDEX IF EXISTS idx_resources_profile_type_updated;
      DROP INDEX IF EXISTS idx_resources_profile_archived_updated;
      DROP INDEX IF EXISTS idx_resources_profile_source;

      CREATE TABLE resources (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('quiz', 'practice_guide', 'resource_folder', 'roleplay')),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '',
        archived_at TEXT,
        source_resource_id TEXT,
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
        FOREIGN KEY (source_resource_id)
          REFERENCES resources (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX idx_resources_id_type
        ON resources (id, type);

      CREATE INDEX idx_resources_user_profile_updated
        ON resources (user_id, profile_id, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_resources_profile_type_updated
        ON resources (profile_id, type, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_resources_profile_archived_updated
        ON resources (profile_id, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_resources_profile_source
        ON resources (profile_id, source_resource_id, shared_via);

      CREATE TABLE resource_folders (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id)
          REFERENCES resources (id)
          ON DELETE CASCADE
      );

      CREATE TABLE resource_folder_items (
        folder_id TEXT NOT NULL,
        resource_id TEXT NOT NULL UNIQUE,
        resource_type TEXT NOT NULL CHECK (resource_type IN ('quiz', 'practice_guide', 'resource_folder', 'roleplay')),
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (folder_id, resource_id),
        FOREIGN KEY (folder_id)
          REFERENCES resource_folders (id)
          ON DELETE CASCADE,
        FOREIGN KEY (resource_id, resource_type)
          REFERENCES resources (id, type)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_resource_folder_items_folder_position
        ON resource_folder_items (folder_id, position ASC, created_at ASC);

      CREATE TABLE resource_share_links (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (resource_id)
          REFERENCES resources (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_resource_share_links_resource_active
        ON resource_share_links (resource_id, revoked_at, created_at DESC);

      CREATE TABLE resource_access_grants (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        granted_by_user_id TEXT NOT NULL,
        granted_via TEXT NOT NULL CHECK (granted_via IN ('profile', 'link')),
        share_link_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (resource_id)
          REFERENCES resources (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (granted_by_user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (share_link_id)
          REFERENCES resource_share_links (id)
          ON DELETE SET NULL,
        UNIQUE (resource_id, user_id, profile_id)
      );

      CREATE INDEX idx_resource_access_grants_profile_active
        ON resource_access_grants (user_id, profile_id, revoked_at, created_at DESC);

      CREATE INDEX idx_resource_access_grants_resource_active
        ON resource_access_grants (resource_id, revoked_at, created_at DESC);

      INSERT INTO resources (
        id,
        user_id,
        profile_id,
        type,
        title,
        description,
        topic,
        level,
        archived_at,
        source_resource_id,
        source_user_id,
        source_profile_id,
        shared_via,
        created_at,
        updated_at
      )
      SELECT
        id,
        user_id,
        profile_id,
        type,
        title,
        description,
        topic,
        level,
        archived_at,
        source_resource_id,
        source_user_id,
        source_profile_id,
        shared_via,
        created_at,
        updated_at
      FROM resources_old;

      INSERT INTO resource_folders (id, created_at, updated_at)
      SELECT id, created_at, updated_at
      FROM resource_folders_old;

      INSERT INTO resource_folder_items (
        folder_id,
        resource_id,
        resource_type,
        position,
        created_at,
        updated_at
      )
      SELECT
        folder_id,
        resource_id,
        resource_type,
        position,
        created_at,
        updated_at
      FROM resource_folder_items_old;

      INSERT INTO resource_share_links (id, resource_id, created_at, revoked_at)
      SELECT id, resource_id, created_at, revoked_at
      FROM resource_share_links_old;

      INSERT INTO resource_access_grants (
        id,
        resource_id,
        user_id,
        profile_id,
        granted_by_user_id,
        granted_via,
        share_link_id,
        created_at,
        updated_at,
        revoked_at
      )
      SELECT
        id,
        resource_id,
        user_id,
        profile_id,
        granted_by_user_id,
        granted_via,
        share_link_id,
        created_at,
        updated_at,
        revoked_at
      FROM resource_access_grants_old;

      DROP TABLE resource_access_grants_old;
      DROP TABLE resource_share_links_old;
      DROP TABLE resource_folder_items_old;
      DROP TABLE resource_folders_old;
      DROP TABLE resources_old;

      CREATE TABLE roleplays (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        scenario TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '',
        pedagogical_focus TEXT NOT NULL DEFAULT '',
        max_learner_turns INTEGER,
        characters_json TEXT NOT NULL,
        authoring_messages_json TEXT NOT NULL DEFAULT '[]',
        source_roleplay_id TEXT,
        source_user_id TEXT,
        source_profile_id TEXT,
        shared_via TEXT CHECK (shared_via IS NULL OR shared_via IN ('profile', 'link')),
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id)
          REFERENCES resources (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE,
        FOREIGN KEY (source_roleplay_id)
          REFERENCES roleplays (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (source_profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_roleplays_user_profile_updated
        ON roleplays (user_id, profile_id, updated_at DESC, created_at DESC);

      CREATE INDEX idx_roleplays_profile_archived_updated
        ON roleplays (profile_id, archived_at, updated_at DESC, created_at DESC);

      CREATE INDEX idx_roleplays_profile_source
        ON roleplays (profile_id, source_roleplay_id, shared_via);

      CREATE TABLE roleplay_attempts (
        id TEXT PRIMARY KEY,
        roleplay_id TEXT NOT NULL,
        user_id TEXT,
        profile_id TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'evaluating', 'evaluated', 'failed')),
        snapshot_json TEXT NOT NULL,
        turns_json TEXT NOT NULL DEFAULT '[]',
        result_json TEXT,
        progress_event_id INTEGER,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at TEXT,
        evaluated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roleplay_id)
          REFERENCES roleplays (id)
          ON DELETE CASCADE,
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE SET NULL,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE SET NULL,
        FOREIGN KEY (progress_event_id)
          REFERENCES learner_progress_events (id)
          ON DELETE SET NULL
      );

      CREATE INDEX idx_roleplay_attempts_roleplay_created
        ON roleplay_attempts (roleplay_id, created_at DESC);

      CREATE INDEX idx_roleplay_attempts_user_profile_created
        ON roleplay_attempts (user_id, profile_id, created_at DESC);

      CREATE TABLE conversation_roleplay_attempt_snapshots (
        conversation_id TEXT PRIMARY KEY,
        roleplay_attempt_id TEXT NOT NULL,
        roleplay_title TEXT NOT NULL,
        roleplay_description TEXT NOT NULL DEFAULT '',
        roleplay_snapshot_json TEXT NOT NULL,
        turns_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE,
        FOREIGN KEY (roleplay_attempt_id)
          REFERENCES roleplay_attempts (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_conversation_roleplay_attempt_snapshots_attempt
        ON conversation_roleplay_attempt_snapshots (roleplay_attempt_id, created_at DESC);
    `,
  },
];
