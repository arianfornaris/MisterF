import { getDb } from './database.js';
import { migrations } from './migrations.js';
export function migrate() {
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
        .all();
    const appliedIds = new Set(appliedRows.map((row) => row.id));
    const pending = migrations.filter((migration) => !appliedIds.has(migration.id));
    // Programmatic migrations may edit sqlite_master, which better-sqlite3
    // blocks unless unsafe mode is on. Unsafe mode cannot toggle inside a
    // transaction, so enable it around the whole apply and reload the schema
    // afterwards.
    const needsUnsafeMode = pending.some((migration) => migration.run);
    const applyAll = db.transaction(() => {
        const insertMigration = db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)');
        for (const migration of pending) {
            if (migration.run) {
                migration.run(db);
            }
            else if (migration.up) {
                db.exec(migration.up);
            }
            insertMigration.run(migration.id, migration.name);
        }
    });
    if (needsUnsafeMode) {
        db.unsafeMode(true);
    }
    try {
        applyAll();
    }
    finally {
        if (needsUnsafeMode) {
            db.unsafeMode(false);
            // Reload the in-memory schema so this connection sees the edited DDL.
            db.pragma('writable_schema = RESET');
        }
    }
}
//# sourceMappingURL=migrator.js.map