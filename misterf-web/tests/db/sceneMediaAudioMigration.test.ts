import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrations } from '../../src/server/db/migrations.js';

describe('scene media audio migration', () => {
  it('removes obsolete single-file audio rows and keeps image-only and clip media', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE user_scene_media (
        id TEXT PRIMARY KEY,
        audio_json TEXT
      );
    `);
    const insert = db.prepare(
      'INSERT INTO user_scene_media (id, audio_json) VALUES (?, ?)',
    );
    insert.run('legacy', JSON.stringify({ format: 'mp3', src: '/old.mp3' }));
    insert.run('image-only', null);
    insert.run('clips', JSON.stringify({
      clips: [{ speaker: 'Narrator', src: '/turn-01.wav', turn: 1 }],
      format: 'wav',
      voiceStrategy: 'per_turn_clips',
    }));

    const migration = migrations.find(({ id }) => id === 21);
    expect(migration?.up).toBeTruthy();
    db.exec(migration?.up ?? '');

    const rows = db.prepare(
      'SELECT id FROM user_scene_media ORDER BY id',
    ).all() as Array<{ id: string }>;
    expect(rows.map(({ id }) => id)).toEqual(['clips', 'image-only']);
    db.close();
  });
});
