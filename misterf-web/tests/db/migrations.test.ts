import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type SchemaMigrationRow = {
  id: number;
  name: string;
};

type TableRow = {
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
  it('creates the current schema from an empty SQLite database', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-migrations-'));
    const databasePath = path.join(tempDir, 'fresh.sqlite');
    process.env.DATABASE_PATH = databasePath;
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
        name: 'add_teacher_assigned_practice',
      },
    ]);

    const tableNames = (db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as TableRow[])
      .map((row) => row.name);

    expect(tableNames).toEqual(expect.arrayContaining([
      'auth_action_tokens',
      'assignment_attempts',
      'assignment_authoring_revisions',
      'assignment_authoring_sessions',
      'assignment_share_links',
      'assignments',
      'chat_room_conversation_reports',
      'chat_room_messages',
      'chat_rooms',
      'conversation_chat_room_report_snapshots',
      'conversation_assignment_attempt_snapshots',
      'conversation_tutor_plans',
      'conversation_tutor_report_snapshots',
      'conversations',
      'credit_purchases',
      'learner_progress_events',
      'learner_progress_profiles',
      'messages',
      'practice_module_collections',
      'practice_modules',
      'profiles',
      'schema_migrations',
      'tutor_conversation_reports',
      'user_openrouter_keys',
      'user_sessions',
      'users',
    ]));

    expect(getColumnNames(db, 'profiles')).toEqual(expect.arrayContaining([
      'learning_context',
      'model_tier',
      'profile_onboarding_completed_at',
    ]));
    expect(getColumnNames(db, 'conversations')).toEqual(expect.arrayContaining([
      'chat_room_conversation_report_id',
      'closed_at',
      'model_tier',
    ]));
    expect(getColumnNames(db, 'chat_room_messages')).toEqual(expect.arrayContaining([
      'evaluation_created_at',
      'evaluation_problem',
      'evaluation_status',
    ]));
    expect(getColumnNames(db, 'assignments')).toEqual(expect.arrayContaining([
      'quiz_json',
      'published_at',
      'target_topic',
    ]));
    expect(getColumnNames(db, 'assignment_attempts')).toEqual(expect.arrayContaining([
      'claim_token',
      'guest_token',
      'result_json',
      'snapshot_json',
    ]));
  });
});

function getColumnNames(
  db: { prepare: (sql: string) => { all: () => unknown[] } },
  tableName: string,
): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumnRow[])
    .map((row) => row.name);
}
