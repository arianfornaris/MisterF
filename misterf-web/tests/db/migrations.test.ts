import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type SchemaMigrationRow = {
  id: number;
  name: string;
};

type NamedSchemaObject = {
  name: string;
};

type TableColumnRow = {
  name: string;
};

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

afterEach(async () => {
  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  if (originalDatabasePath === undefined) {
    delete process.env.DATABASE_PATH;
  } else {
    process.env.DATABASE_PATH = originalDatabasePath;
  }

  if (originalEnvFile === undefined) {
    delete process.env.ENV_FILE;
  } else {
    process.env.ENV_FILE = originalEnvFile;
  }
});

describe('database migrations', () => {
  it('creates the complete current schema from one clean baseline', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-migrations-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'fresh.sqlite');
    process.env.ENV_FILE = '/dev/null';
    vi.resetModules();

    const { getDb } = await import('../../src/server/db/database.js');
    const { migrate } = await import('../../src/server/db/migrator.js');

    migrate();

    const db = getDb();
    const appliedMigrations = db
      .prepare('SELECT id, name FROM schema_migrations ORDER BY id')
      .all() as SchemaMigrationRow[];

    expect(appliedMigrations).toEqual([
      {
        id: 1,
        name: 'create_current_schema',
      },
      {
        id: 2,
        name: 'add_roleplay_attempts_collect_results',
      },
      {
        id: 3,
        name: 'add_conversations_collect_results',
      },
    ]);

    const tableNames = (db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name <> 'sqlite_sequence'
      ORDER BY name
    `).all() as NamedSchemaObject[]).map(({ name }) => name);

    expect(tableNames).toEqual([
      'auth_action_tokens',
      'conversation_practice_guide_snapshots',
      'conversation_quiz_attempt_snapshots',
      'conversation_roleplay_attempt_snapshots',
      'conversation_tutor_plans',
      'conversation_tutor_report_snapshots',
      'conversations',
      'credit_purchases',
      'learner_progress_events',
      'learner_progress_profiles',
      'messages',
      'practice_guides',
      'profiles',
      'quiz_attempts',
      'quiz_response_summaries',
      'quizzes',
      'resource_access_grants',
      'resource_folder_items',
      'resource_folders',
      'resource_share_links',
      'resources',
      'roleplay_attempts',
      'roleplays',
      'schema_migrations',
      'tutor_conversation_reports',
      'user_identities',
      'user_openrouter_keys',
      'user_scene_media',
      'user_sessions',
      'users',
    ]);

    const expectedColumns: Record<string, string[]> = {
      auth_action_tokens: [
        'id', 'user_id', 'type', 'token_hash', 'created_at', 'expires_at', 'used_at',
      ],
      conversation_practice_guide_snapshots: [
        'conversation_id', 'practice_guide_id', 'title', 'description',
        'tutor_instructions', 'created_at',
      ],
      conversation_quiz_attempt_snapshots: [
        'conversation_id', 'quiz_attempt_id', 'quiz_title', 'quiz_description',
        'quiz_target_topic', 'quiz_snapshot_json', 'responses_json', 'result_json',
        'created_at',
      ],
      conversation_roleplay_attempt_snapshots: [
        'conversation_id', 'roleplay_attempt_id', 'roleplay_title',
        'roleplay_description', 'roleplay_snapshot_json', 'turns_json', 'result_json',
        'created_at',
      ],
      conversation_tutor_plans: [
        'conversation_id', 'plan_json', 'created_at', 'updated_at',
      ],
      conversation_tutor_report_snapshots: [
        'conversation_id', 'tutor_conversation_report_id', 'source_conversation_id',
        'report_summary_title', 'report_summary_description', 'report_json', 'created_at',
      ],
      conversations: [
        'id', 'user_id', 'profile_id', 'active_agent', 'practice_guide_id',
        'model_tier', 'title', 'title_updated_by_user', 'closed_at', 'created_at',
        'updated_at', 'instruction_language', 'collect_results',
      ],
      credit_purchases: [
        'id', 'user_id', 'stripe_checkout_session_id', 'stripe_payment_intent_id',
        'stripe_event_id', 'package_code', 'customer_amount_cents',
        'credited_amount_cents', 'status', 'openrouter_key_hash',
        'remaining_before_usd', 'remaining_after_usd', 'failure_reason', 'created_at',
        'updated_at',
      ],
      learner_progress_events: [
        'id', 'user_id', 'profile_id', 'source_type', 'source_id', 'event_date',
        'title', 'summary', 'details_json', 'created_at', 'updated_at',
      ],
      learner_progress_profiles: [
        'id', 'user_id', 'profile_id', 'summary_json', 'created_at', 'updated_at',
      ],
      messages: [
        'id', 'conversation_id', 'role', 'content', 'metadata', 'created_at',
      ],
      practice_guides: [
        'id', 'user_id', 'profile_id', 'title', 'description', 'tutor_instructions',
        'source_practice_guide_id', 'source_user_id', 'source_profile_id', 'shared_via',
        'archived_at', 'created_at', 'updated_at', 'authoring_messages_json',
      ],
      profiles: [
        'id', 'user_id', 'name', 'description', 'model_tier', 'learning_context',
        'profile_onboarding_completed_at', 'created_at', 'updated_at',
        'instruction_language',
      ],
      quiz_attempts: [
        'id', 'quiz_id', 'user_id', 'profile_id', 'guest_token', 'claim_token',
        'status', 'snapshot_json', 'responses_json', 'result_json', 'progress_event_id',
        'started_at', 'submitted_at', 'evaluated_at', 'created_at', 'updated_at',
        'collect_results',
      ],
      quiz_response_summaries: [
        'quiz_id', 'summary_text', 'input_fingerprint', 'generated_at',
      ],
      quizzes: [
        'id', 'user_id', 'profile_id', 'title', 'description', 'target_topic', 'level',
        'instructions', 'quiz_json', 'archived_at', 'source_quiz_id', 'source_user_id',
        'source_profile_id', 'shared_via', 'created_at', 'updated_at',
        'authoring_messages_json',
      ],
      resource_access_grants: [
        'id', 'resource_id', 'user_id', 'profile_id', 'granted_by_user_id',
        'granted_via', 'share_link_id', 'created_at', 'updated_at', 'revoked_at',
        'collect_results',
      ],
      resource_folder_items: [
        'folder_id', 'resource_id', 'resource_type', 'position', 'created_at',
        'updated_at',
      ],
      resource_folders: ['id', 'created_at', 'updated_at'],
      resource_share_links: [
        'id', 'resource_id', 'created_at', 'revoked_at', 'collect_results',
      ],
      resources: [
        'id', 'user_id', 'profile_id', 'type', 'title', 'description', 'topic', 'level',
        'archived_at', 'source_resource_id', 'source_user_id', 'source_profile_id',
        'shared_via', 'created_at', 'updated_at',
      ],
      roleplay_attempts: [
        'id', 'roleplay_id', 'user_id', 'profile_id', 'status', 'snapshot_json',
        'turns_json', 'result_json', 'progress_event_id', 'started_at', 'submitted_at',
        'evaluated_at', 'created_at', 'updated_at', 'collect_results',
      ],
      roleplays: [
        'id', 'user_id', 'profile_id', 'title', 'description', 'level',
        'characters_json', 'authoring_messages_json', 'source_roleplay_id',
        'source_user_id', 'source_profile_id', 'shared_via', 'archived_at', 'created_at',
        'updated_at',
      ],
      tutor_conversation_reports: [
        'id', 'conversation_id', 'user_id', 'profile_id', 'summary_title',
        'summary_description', 'report_json', 'practice_guide_id', 'created_at',
        'updated_at',
      ],
      user_identities: [
        'id', 'user_id', 'provider', 'provider_subject', 'email', 'created_at',
      ],
      user_openrouter_keys: [
        'user_id', 'key_hash', 'encrypted_api_key', 'name', 'limit_usd',
        'limit_reset', 'status', 'last_error', 'created_at', 'updated_at',
      ],
      user_scene_media: [
        'id', 'user_id', 'profile_id', 'source_media_id', 'source_visual_asset_id',
        'title', 'status', 'generation_mode', 'generation_prompt',
        'script_type_preference', 'format', 'level', 'setting', 'visual_summary_json',
        'image_json', 'audio_json', 'script_json', 'created_from_json',
        'provenance_json', 'authoring_messages_json', 'archived_at', 'created_at',
        'updated_at',
      ],
      user_sessions: [
        'id', 'user_id', 'token_hash', 'user_agent', 'ip_address', 'created_at',
        'last_seen_at', 'expires_at', 'revoked_at',
      ],
      users: [
        'id', 'email', 'full_name', 'password_hash', 'email_verified', 'created_at',
        'updated_at', 'disabled_at',
      ],
    };

    for (const [tableName, columns] of Object.entries(expectedColumns)) {
      expect(getColumnNames(db, tableName), tableName).toEqual(columns);
    }

    const indexNames = (db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND sql IS NOT NULL
      ORDER BY name
    `).all() as NamedSchemaObject[]).map(({ name }) => name);

    expect(indexNames).toHaveLength(46);
    expect(indexNames).toEqual(expect.arrayContaining([
      'idx_messages_conversation_created',
      'idx_quizzes_user_profile_updated',
      'idx_resource_folder_items_folder_position',
      'idx_resources_id_type',
      'idx_resources_profile_archived_updated',
      'idx_roleplays_profile_archived_updated',
      'idx_user_scene_media_profile_status_updated',
      'idx_user_sessions_user_active',
    ]));

    for (const tableName of ['profiles', 'conversations']) {
      const sql = getTableSql(db, tableName);
      expect(sql).toContain('instruction_language TEXT NOT NULL');
      expect(sql).not.toContain('CHECK (instruction_language');
      expect(sql).toContain('model_tier TEXT NOT NULL');
      expect(sql).not.toContain('CHECK (model_tier');
    }

    expect(getTableSql(db, 'resources')).toContain("'roleplay'");
    expect(getTableSql(db, 'resource_folder_items')).toContain("'resource_folder'");
    expect(getTableSql(db, 'resource_folder_items')).toContain("'roleplay'");

    const sceneMediaSql = getTableSql(db, 'user_scene_media');
    expect(sceneMediaSql).toContain("generation_mode = 'image_only'");
    expect(sceneMediaSql).toContain("generation_mode = 'complete_scene'");
    expect(sceneMediaSql).toContain("status = 'archived'");

    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.prepare('PRAGMA integrity_check').get()).toEqual({
      integrity_check: 'ok',
    });
  });
});

function getColumnNames(
  db: { prepare: (sql: string) => { all: () => unknown[] } },
  tableName: string,
): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumnRow[])
    .map(({ name }) => name);
}

function getTableSql(
  db: {
    prepare: (sql: string) => {
      get: (tableName: string) => unknown;
    };
  },
  tableName: string,
): string {
  const row = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tableName) as { sql: string };

  return row.sql;
}
