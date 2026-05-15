import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
let db;
export function getDb() {
    if (!db) {
        fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
        db = new Database(env.databasePath);
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');
    }
    return db;
}
export function closeDb() {
    db?.close();
    db = undefined;
}
//# sourceMappingURL=database.js.map