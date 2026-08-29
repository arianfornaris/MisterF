import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalEncryptionSecret = process.env.OPENROUTER_KEY_ENCRYPTION_SECRET;
const originalManagementKey = process.env.OPENROUTER_MANAGEMENT_API_KEY;
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-openrouter-key-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'openrouter-key.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.OPENROUTER_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
  process.env.OPENROUTER_MANAGEMENT_API_KEY = 'test-management-key';
  vi.resetModules();

  const { migrate } = await import('../../src/server/db/migrator.js');
  migrate();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  globalThis.fetch = originalFetch;
  restoreEnv('DATABASE_PATH', originalDatabasePath);
  restoreEnv('ENV_FILE', originalEnvFile);
  restoreEnv('OPENROUTER_KEY_ENCRYPTION_SECRET', originalEncryptionSecret);
  restoreEnv('OPENROUTER_MANAGEMENT_API_KEY', originalManagementKey);
});

describe('OpenRouter key provisioning is gated on email verification', () => {
  it('does not call OpenRouter for an unverified account', async () => {
    await insertUser('unverified-user', { emailVerified: false });
    const fetchMock = stubOpenRouterFetch();

    const { ensureOpenRouterKeyForUser, getOpenRouterKeyRecordForUser } = await import(
      '../../src/server/services/openRouterUserKeys.js'
    );
    await ensureOpenRouterKeyForUser('unverified-user');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getOpenRouterKeyRecordForUser('unverified-user')).toBeNull();
  });

  it('provisions a key once the address is verified', async () => {
    await insertUser('verified-user', { emailVerified: true });
    const fetchMock = stubOpenRouterFetch();

    const { ensureOpenRouterKeyForUser, getOpenRouterKeyRecordForUser } = await import(
      '../../src/server/services/openRouterUserKeys.js'
    );
    await ensureOpenRouterKeyForUser('verified-user');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getOpenRouterKeyRecordForUser('verified-user')?.status).toBe('active');
  });

  it('leaves an already-provisioned key untouched', async () => {
    await insertUser('returning-user', { emailVerified: true });
    const fetchMock = stubOpenRouterFetch();

    const { ensureOpenRouterKeyForUser } = await import(
      '../../src/server/services/openRouterUserKeys.js'
    );
    await ensureOpenRouterKeyForUser('returning-user');
    await ensureOpenRouterKeyForUser('returning-user');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function stubOpenRouterFetch() {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({ key: 'sk-or-test-key', data: { hash: 'test-hash' } }),
      { headers: { 'content-type': 'application/json' }, status: 200 },
    ),
  );

  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  return fetchMock;
}

async function insertUser(
  userId: string,
  options: { emailVerified: boolean },
): Promise<void> {
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
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(
      userId,
      `${userId}@example.test`,
      'OpenRouter Key Test User',
      options.emailVerified ? 1 : 0,
    );
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
