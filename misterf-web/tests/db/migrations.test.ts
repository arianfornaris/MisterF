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
      {
        id: 3,
        name: 'simplify_assignment_lifecycle',
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
      'target_topic',
    ]));
    expect(getColumnNames(db, 'assignments')).not.toEqual(expect.arrayContaining([
      'published_at',
      'status',
    ]));
    expect(getColumnNames(db, 'assignment_attempts')).toEqual(expect.arrayContaining([
      'authoring_session_id',
      'claim_token',
      'guest_token',
      'result_json',
      'snapshot_json',
    ]));
  });

  it('migrates existing assignment lifecycle data without losing attempts', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-migrations-upgrade-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'upgrade.sqlite');
    process.env.ENV_FILE = '/dev/null';
    vi.resetModules();

    const { getDb } = await import('../../src/server/db/database.js');
    const { migrations } = await import('../../src/server/db/migrations.js');
    const { migrate } = await import('../../src/server/db/migrator.js');
    const db = getDb();

    db.exec(`
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const migration of migrations.filter((migration) => migration.id <= 2)) {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)')
        .run(migration.id, migration.name);
    }

    const draftJson = JSON.stringify({
      blocks: [
        {
          id: 'open_text',
          item: {
            kind: 'quiz_open_text',
            prompt: 'Write one sentence.',
          },
        },
      ],
      title: 'Legacy assignment',
    });

    db.prepare(`
      INSERT INTO users (id, email, full_name, email_verified)
      VALUES ('user_1', 'legacy@example.com', 'Legacy User', 1)
    `).run();
    db.prepare(`
      INSERT INTO profiles (id, user_id, name)
      VALUES ('profile_1', 'user_1', 'Legacy Profile')
    `).run();
    db.prepare(`
      INSERT INTO assignments (
        id,
        user_id,
        profile_id,
        title,
        quiz_json,
        status,
        published_at
      )
      VALUES ('assignment_1', 'user_1', 'profile_1', 'Legacy assignment', ?, 'published', CURRENT_TIMESTAMP)
    `).run(draftJson);
    db.prepare(`
      INSERT INTO assignment_authoring_sessions (
        id,
        assignment_id,
        user_id,
        profile_id,
        status,
        current_draft_json
      )
      VALUES ('session_1', 'assignment_1', 'user_1', 'profile_1', 'published', ?)
    `).run(draftJson);
    db.prepare(`
      INSERT INTO assignment_authoring_revisions (
        id,
        authoring_session_id,
        source,
        draft_json
      )
      VALUES ('revision_1', 'session_1', 'assistant', ?)
    `).run(draftJson);
    db.prepare(`
      INSERT INTO assignment_attempts (
        id,
        assignment_id,
        user_id,
        profile_id,
        snapshot_json
      )
      VALUES ('attempt_1', 'assignment_1', 'user_1', 'profile_1', ?)
    `).run(draftJson);
    db.prepare(`
      INSERT INTO conversations (id, user_id, profile_id, title)
      VALUES ('conversation_1', 'user_1', 'profile_1', 'Legacy conversation')
    `).run();
    db.prepare(`
      INSERT INTO conversation_assignment_attempt_snapshots (
        conversation_id,
        assignment_attempt_id,
        assignment_title,
        assignment_snapshot_json,
        responses_json,
        result_json
      )
      VALUES ('conversation_1', 'attempt_1', 'Legacy assignment', ?, '[]', '{}')
    `).run(draftJson);

    migrate();

    expect(getColumnNames(db, 'assignments')).not.toEqual(expect.arrayContaining([
      'published_at',
      'status',
    ]));
    expect(getColumnNames(db, 'assignment_attempts')).toEqual(expect.arrayContaining([
      'authoring_session_id',
    ]));
    expect(db.prepare('SELECT status FROM assignment_authoring_sessions WHERE id = ?')
      .get('session_1')).toEqual({ status: 'saved' });
    expect(db.prepare('SELECT assignment_id, authoring_session_id FROM assignment_attempts WHERE id = ?')
      .get('attempt_1')).toEqual({
      assignment_id: 'assignment_1',
      authoring_session_id: null,
    });
    expect(db.prepare('SELECT assignment_attempt_id FROM conversation_assignment_attempt_snapshots WHERE conversation_id = ?')
      .get('conversation_1')).toEqual({ assignment_attempt_id: 'attempt_1' });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'conversation_assignment_attempt_snapshots'")
      .get()).toEqual(expect.objectContaining({
      sql: expect.stringContaining('REFERENCES assignment_attempts'),
    }));
  });
});

function getColumnNames(
  db: { prepare: (sql: string) => { all: () => unknown[] } },
  tableName: string,
): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumnRow[])
    .map((row) => row.name);
}
