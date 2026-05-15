import { getDb } from './database.js';
import { migrations } from './migrations.js';

type AppliedMigrationRow = {
  id: number;
};

export function migrate(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = db
    .prepare('SELECT id FROM schema_migrations ORDER BY id')
    .all() as AppliedMigrationRow[];
  const appliedIds = new Set(appliedRows.map((row) => row.id));

  const applyAll = db.transaction(() => {
    const insertMigration = db.prepare(
      'INSERT INTO schema_migrations (id, name) VALUES (?, ?)',
    );

    for (const migration of migrations) {
      if (appliedIds.has(migration.id)) {
        continue;
      }

      db.exec(migration.up);
      insertMigration.run(migration.id, migration.name);
    }
  });

  applyAll();
}
