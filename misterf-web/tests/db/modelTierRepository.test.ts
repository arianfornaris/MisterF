import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-model-tier-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'model-tier.sqlite');
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();

  const { migrate } = await import('../../src/server/db/migrator.js');
  migrate();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  restoreEnv('DATABASE_PATH', originalDatabasePath);
  restoreEnv('ENV_FILE', originalEnvFile);
});

describe('model tier repository defaults', () => {
  it('uses lite for new profiles and their conversations', async () => {
    await insertUser('default-lite-user');
    const repository = await import('../../src/server/db/repository.js');

    const profile = repository.createProfile({
      name: 'Default profile',
      userId: 'default-lite-user',
    });
    const conversation = repository.createConversation(
      'default-lite-user',
      profile.id,
    );

    expect(profile.modelTier).toBe('lite');
    expect(conversation.modelTier).toBe('lite');
  });

  it('preserves an explicitly selected profile tier', async () => {
    await insertUser('explicit-tier-user');
    const repository = await import('../../src/server/db/repository.js');

    const profile = repository.createProfile({
      modelTier: 'regular',
      name: 'Regular profile',
      userId: 'explicit-tier-user',
    });
    const conversation = repository.createConversation(
      'explicit-tier-user',
      profile.id,
    );

    expect(profile.modelTier).toBe('regular');
    expect(conversation.modelTier).toBe('regular');
  });
});

async function insertUser(userId: string): Promise<void> {
  const { getDb } = await import('../../src/server/db/database.js');
  getDb()
    .prepare(
      `
        INSERT INTO users (
          id,
          email,
          full_name,
          email_verified
        )
        VALUES (?, ?, ?, 1)
      `,
    )
    .run(userId, `${userId}@example.test`, 'Model Tier Test User');
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
