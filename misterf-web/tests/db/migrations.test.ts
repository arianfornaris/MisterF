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
      {
        id: 4,
        name: 'remove_assignment_authoring_revisions',
      },
      {
        id: 5,
        name: 'remove_assignment_authoring_sessions',
      },
      {
        id: 6,
        name: 'drop_assignment_estimated_minutes',
      },
      {
        id: 7,
        name: 'drop_assignment_rubric',
      },
      {
        id: 8,
        name: 'add_assignment_authoring_messages',
      },
      {
        id: 9,
        name: 'add_resource_foundation',
      },
    ]);

    const tableNames = (db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as TableRow[])
      .map((row) => row.name);

    expect(tableNames).toEqual(expect.arrayContaining([
      'auth_action_tokens',
      'assignment_attempts',
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
      'practice_modules',
      'profiles',
      'resource_folder_items',
      'resource_folders',
      'resource_share_links',
      'resources',
      'schema_migrations',
      'tutor_conversation_reports',
      'user_openrouter_keys',
      'user_sessions',
      'users',
    ]));
    expect(tableNames).not.toContain('assignment_authoring_revisions');
    expect(tableNames).not.toContain('assignment_authoring_sessions');
    expect(tableNames).not.toContain('practice_module_collections');
    expect(tableNames).not.toContain('practice_module_collection_share_links');

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
      'authoring_messages_json',
      'quiz_json',
      'shared_via',
      'source_assignment_id',
      'source_profile_id',
      'source_user_id',
      'target_topic',
    ]));
    expect(getColumnNames(db, 'assignments')).not.toEqual(expect.arrayContaining([
      'estimated_minutes',
      'is_favorite',
      'published_at',
      'rubric',
      'status',
    ]));
    expect(getColumnNames(db, 'practice_modules')).not.toEqual(expect.arrayContaining([
      'collection_id',
      'position_in_collection',
    ]));
    expect(getColumnNames(db, 'assignment_attempts')).toEqual(expect.arrayContaining([
      'claim_token',
      'guest_token',
      'result_json',
      'snapshot_json',
    ]));
    expect(getColumnNames(db, 'assignment_attempts')).not.toContain('authoring_session_id');
    expect(getColumnNames(db, 'resources')).toEqual(expect.arrayContaining([
      'archived_at',
      'description',
      'id',
      'level',
      'profile_id',
      'shared_via',
      'source_resource_id',
      'title',
      'topic',
      'type',
      'user_id',
    ]));
    expect(getColumnNames(db, 'resources')).not.toContain('is_favorite');
    expect(getColumnNames(db, 'resource_folder_items')).toEqual(expect.arrayContaining([
      'folder_id',
      'position',
      'resource_id',
      'resource_type',
    ]));
  });

  it('backfills resources and share links from legacy resource tables', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-migrations-resources-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'resources.sqlite');
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

    for (const migration of migrations.filter((migration) => migration.id <= 8)) {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)')
        .run(migration.id, migration.name);
    }

    const assignmentDraft = JSON.stringify({
      blocks: [],
      title: 'Resource assignment',
    });

    db.prepare(`
      INSERT INTO users (id, email, full_name, email_verified)
      VALUES ('user_1', 'resources@example.com', 'Resources User', 1)
    `).run();
    db.prepare(`
      INSERT INTO profiles (id, user_id, name)
      VALUES ('profile_1', 'user_1', 'Resources Profile')
    `).run();
    db.prepare(`
      INSERT INTO assignments (
        id,
        user_id,
        profile_id,
        title,
        description,
        target_topic,
        level,
        quiz_json,
        authoring_messages_json
      )
      VALUES (
        'assignment_1',
        'user_1',
        'profile_1',
        'Resource Assignment',
        'Assignment description.',
        'Past perfect',
        'B2',
        ?,
        '[]'
      )
    `).run(assignmentDraft);
    db.prepare(`
      INSERT INTO practice_modules (
        id,
        user_id,
        profile_id,
        title,
        description,
        tutor_instructions
      )
      VALUES (
        'module_1',
        'user_1',
        'profile_1',
        'Legacy Module',
        'Module description.',
        'Practice modal verbs.'
      )
    `).run();
    db.prepare(`
      INSERT INTO assignment_share_links (id, assignment_id)
      VALUES ('assignment_link_1', 'assignment_1')
    `).run();
    db.prepare(`
      INSERT INTO practice_module_share_links (id, practice_module_id)
      VALUES ('module_link_1', 'module_1')
    `).run();

    migrate();

    expect(db.prepare('SELECT type, topic, level FROM resources WHERE id = ?')
      .get('assignment_1')).toEqual({
      level: 'B2',
      topic: 'Past perfect',
      type: 'assignment',
    });
    expect(db.prepare('SELECT type FROM resources WHERE id = ?')
      .get('module_1')).toEqual({ type: 'practice_guide' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM resource_folder_items')
      .get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT resource_id FROM resource_share_links WHERE id = ?')
      .get('assignment_link_1')).toEqual({ resource_id: 'assignment_1' });
    expect(db.prepare('SELECT resource_id FROM resource_share_links WHERE id = ?')
      .get('module_link_1')).toEqual({ resource_id: 'module_1' });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
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
      'estimated_minutes',
      'published_at',
      'rubric',
      'status',
    ]));
    expect(getColumnNames(db, 'assignment_attempts')).not.toContain('authoring_session_id');
    expect(getColumnNames(db, 'assignments')).not.toContain('estimated_minutes');
    expect(getColumnNames(db, 'assignments')).not.toContain('rubric');
    expect(getColumnNames(db, 'assignments')).toContain('authoring_messages_json');
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'assignment_authoring_sessions'")
      .get()).toBeUndefined();
    expect(db.prepare('SELECT assignment_id FROM assignment_attempts WHERE id = ?')
      .get('attempt_1')).toEqual({ assignment_id: 'assignment_1' });
    expect(db.prepare('SELECT assignment_attempt_id FROM conversation_assignment_attempt_snapshots WHERE conversation_id = ?')
      .get('conversation_1')).toEqual({ assignment_attempt_id: 'attempt_1' });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'assignment_authoring_revisions'")
      .get()).toBeUndefined();
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'conversation_assignment_attempt_snapshots'")
      .get()).toEqual(expect.objectContaining({
      sql: expect.stringContaining('REFERENCES assignment_attempts'),
    }));
  });

  it('promotes legacy authoring sessions before removing the session table', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-migrations-authoring-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'authoring.sqlite');
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

    for (const migration of migrations.filter((migration) => migration.id <= 4)) {
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
      description: 'Legacy generated homework.',
      instructions: 'Answer carefully.',
      level: 'A2',
      targetTopic: 'Simple past',
      title: 'Legacy Generated Task',
    });

    db.prepare(`
      INSERT INTO users (id, email, full_name, email_verified)
      VALUES ('user_1', 'legacy-authoring@example.com', 'Legacy Authoring User', 1)
    `).run();
    db.prepare(`
      INSERT INTO profiles (id, user_id, name)
      VALUES ('profile_1', 'user_1', 'Legacy Profile')
    `).run();
    db.prepare(`
      INSERT INTO assignment_authoring_sessions (
        id,
        user_id,
        profile_id,
        status,
        initial_prompt,
        current_draft_json
      )
      VALUES ('session_orphan', 'user_1', 'profile_1', 'drafting', 'Create a legacy task.', ?)
    `).run(draftJson);
    db.prepare(`
      INSERT INTO assignment_attempts (
        id,
        authoring_session_id,
        user_id,
        profile_id,
        is_preview,
        snapshot_json
      )
      VALUES ('attempt_preview', 'session_orphan', 'user_1', 'profile_1', 1, ?)
    `).run(draftJson);

    migrate();

    expect(db.prepare('SELECT title, target_topic FROM assignments WHERE id = ?')
      .get('session_orphan')).toEqual({
      target_topic: 'Simple past',
      title: 'Legacy Generated Task',
    });
    expect(getColumnNames(db, 'assignments')).toContain('authoring_messages_json');
    expect(db.prepare('SELECT assignment_id, is_preview FROM assignment_attempts WHERE id = ?')
      .get('attempt_preview')).toEqual({
      assignment_id: 'session_orphan',
      is_preview: 1,
    });
    expect(getColumnNames(db, 'assignment_attempts')).not.toContain('authoring_session_id');
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'assignment_authoring_sessions'")
      .get()).toBeUndefined();
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});

function getColumnNames(
  db: { prepare: (sql: string) => { all: () => unknown[] } },
  tableName: string,
): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumnRow[])
    .map((row) => row.name);
}
