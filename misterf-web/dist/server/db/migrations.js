export const migrations = [
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
        limit_reset TEXT CHECK (
          limit_reset IS NULL OR limit_reset IN ('daily', 'weekly', 'monthly')
        ),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'active', 'error', 'disabled')),
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
        model_tier TEXT NOT NULL DEFAULT 'regular',
        learning_context TEXT NOT NULL DEFAULT '',
        profile_onboarding_completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        instruction_language TEXT NOT NULL DEFAULT 'es',
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
        authoring_messages_json TEXT NOT NULL DEFAULT '[]',
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

      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        active_agent TEXT NOT NULL DEFAULT 'tutor' CHECK (active_agent IN ('tutor')),
        practice_guide_id TEXT,
        model_tier TEXT NOT NULL DEFAULT 'regular',
        title TEXT NOT NULL DEFAULT 'Nueva conversación',
        title_updated_by_user INTEGER NOT NULL DEFAULT 0
          CHECK (title_updated_by_user IN (0, 1)),
        closed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        instruction_language TEXT NOT NULL DEFAULT 'es',
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
        ON conversation_tutor_report_snapshots (
          tutor_conversation_report_id,
          created_at DESC
        );

      CREATE TABLE conversation_tutor_plans (
        conversation_id TEXT PRIMARY KEY,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id)
          REFERENCES conversations (id)
          ON DELETE CASCADE
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

      CREATE TABLE quizzes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        target_topic TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '',
        instructions TEXT NOT NULL DEFAULT '',
        quiz_json TEXT NOT NULL,
        archived_at TEXT,
        source_quiz_id TEXT,
        source_user_id TEXT,
        source_profile_id TEXT,
        shared_via TEXT CHECK (shared_via IS NULL OR shared_via IN ('profile', 'link')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        authoring_messages_json TEXT NOT NULL DEFAULT '[]',
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

      CREATE TABLE quiz_attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        user_id TEXT,
        profile_id TEXT,
        guest_token TEXT UNIQUE,
        claim_token TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'submitted', 'evaluating', 'evaluated', 'failed')),
        snapshot_json TEXT NOT NULL,
        responses_json TEXT NOT NULL DEFAULT '[]',
        result_json TEXT,
        progress_event_id INTEGER,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at TEXT,
        evaluated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        collect_results INTEGER NOT NULL DEFAULT 0,
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

      CREATE TABLE resources (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        type TEXT NOT NULL
          CHECK (type IN ('quiz', 'practice_guide', 'resource_folder', 'roleplay')),
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
        ON resources (
          user_id,
          profile_id,
          archived_at,
          updated_at DESC,
          created_at DESC
        );

      CREATE INDEX idx_resources_profile_type_updated
        ON resources (
          profile_id,
          type,
          archived_at,
          updated_at DESC,
          created_at DESC
        );

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
        resource_type TEXT NOT NULL
          CHECK (
            resource_type IN ('quiz', 'practice_guide', 'resource_folder', 'roleplay')
          ),
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
        collect_results INTEGER NOT NULL DEFAULT 1,
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
        collect_results INTEGER NOT NULL DEFAULT 1,
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
        ON resource_access_grants (
          user_id,
          profile_id,
          revoked_at,
          created_at DESC
        );

      CREATE INDEX idx_resource_access_grants_resource_active
        ON resource_access_grants (resource_id, revoked_at, created_at DESC);

      CREATE TABLE roleplays (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '',
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
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'in_progress', 'evaluating', 'evaluated', 'failed')),
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

      CREATE TABLE user_scene_media (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        source_media_id TEXT,
        source_visual_asset_id TEXT,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ready', 'archived')),
        generation_mode TEXT NOT NULL
          CHECK (generation_mode IN ('image_only', 'complete_scene')),
        generation_prompt TEXT NOT NULL,
        script_type_preference TEXT NOT NULL DEFAULT 'unspecified'
          CHECK (
            script_type_preference IN (
              'unspecified',
              'dialogue',
              'narration',
              'monologue'
            )
          ),
        format TEXT NOT NULL
          CHECK (
            format IN (
              'four_panel_wordless_story',
              'single_panel_scene',
              'two_panel_contrast'
            )
          ),
        level TEXT NOT NULL CHECK (level IN ('A1-A2', 'B1-B2', 'C1')),
        setting TEXT,
        visual_summary_json TEXT NOT NULL DEFAULT '[]',
        image_json TEXT NOT NULL,
        audio_json TEXT,
        script_json TEXT,
        created_from_json TEXT NOT NULL DEFAULT '{}',
        provenance_json TEXT NOT NULL DEFAULT '{}',
        authoring_messages_json TEXT NOT NULL DEFAULT '[]',
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (
          (
            generation_mode = 'image_only'
            AND script_json IS NULL
            AND audio_json IS NULL
          )
          OR (
            generation_mode = 'complete_scene'
            AND script_json IS NOT NULL
            AND audio_json IS NOT NULL
          )
        ),
        CHECK (
          (status = 'ready' AND archived_at IS NULL)
          OR (status = 'archived' AND archived_at IS NOT NULL)
        ),
        FOREIGN KEY (user_id)
          REFERENCES users (id)
          ON DELETE CASCADE,
        FOREIGN KEY (profile_id)
          REFERENCES profiles (id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_user_scene_media_profile_status_updated
        ON user_scene_media (
          user_id,
          profile_id,
          status,
          updated_at DESC,
          created_at DESC
        );

      CREATE INDEX idx_user_scene_media_profile_source
        ON user_scene_media (
          user_id,
          profile_id,
          source_media_id,
          updated_at DESC
        );

      CREATE TABLE quiz_response_summaries (
        quiz_id TEXT PRIMARY KEY,
        summary_text TEXT NOT NULL,
        input_fingerprint TEXT NOT NULL,
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    },
    // Ids continue at 27 rather than 2: `create_current_schema` is the squashed
    // baseline for fresh installs, but databases created before the squash still
    // carry schema_migrations rows 1..26 from the old numbering. The migrator
    // skips any id already present, so reusing low ids would silently never run
    // on those databases. Every id here must stay above the historical maximum.
    {
        id: 27,
        name: 'add_roleplay_attempts_collect_results',
        // Mirrors quiz_attempts.collect_results: the flag is snapshotted at attempt
        // start, so pre-flag attempts default to 0 and are never exposed to the
        // resource owner.
        up: `
      ALTER TABLE roleplay_attempts
        ADD COLUMN collect_results INTEGER NOT NULL DEFAULT 0;
    `,
    },
    {
        id: 28,
        name: 'add_conversations_collect_results',
        // Practice-guide conversations snapshot the share's collect_results flag at
        // start; the finalized tutor_conversation_reports report is surfaced to the
        // guide owner only when this is 1. Default 0 keeps pre-flag sessions private.
        up: `
      ALTER TABLE conversations
        ADD COLUMN collect_results INTEGER NOT NULL DEFAULT 0;
    `,
    },
];
//# sourceMappingURL=migrations.js.map