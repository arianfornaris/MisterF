import { closeDb, getDb } from '../src/server/db/database.js';
import { migrate } from '../src/server/db/migrator.js';
import { getUserFileStorageProvider } from '../src/server/storage/userFileStorage.js';

type MediaRow = {
  audio_json: string | null;
  id: string;
  image_json: string | null;
};

async function main(): Promise<void> {
  migrate();
  const storage = getUserFileStorageProvider();
  const rows = getDb()
    .prepare('SELECT id, image_json, audio_json FROM user_scene_media')
    .all() as MediaRow[];
  const update = getDb().prepare(`
    UPDATE user_scene_media
    SET image_json = ?, audio_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  let updatedCount = 0;

  for (const row of rows) {
    const image = parseLayer(row.image_json);
    const audio = parseLayer(row.audio_json);
    let changed = false;
    for (const layer of [image, audio]) {
      if (!layer?.storageKey) {
        continue;
      }
      const readUrl = await storage.createReadUrl({
        expiresInSeconds: 300,
        storageKey: layer.storageKey,
      });
      const response = await fetch(readUrl);
      if (!response.ok) {
        throw new Error(
          `Unable to read ${layer.storageKey} before public migration (HTTP ${response.status}).`,
        );
      }
      const body = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ||
        layer.contentType ||
        'application/octet-stream';
      await storage.putObject({
        body,
        cacheControl: 'public, max-age=31536000, immutable',
        contentType,
        key: layer.storageKey,
        visibility: 'public-read',
      });
      layer.contentType = contentType;
      layer.src = storage.createPublicUrl(layer.storageKey);
      changed = true;
    }
    if (changed) {
      update.run(
        image ? JSON.stringify(image) : null,
        audio ? JSON.stringify(audio) : null,
        row.id,
      );
      updatedCount += 1;
    }
  }

  console.log(`Publicized ${updatedCount} scene media records.`);
}

function parseLayer(value: string | null): Record<string, string> | null {
  if (!value) {
    return null;
  }
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === 'object'
    ? parsed as Record<string, string>
    : null;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDb();
  });
