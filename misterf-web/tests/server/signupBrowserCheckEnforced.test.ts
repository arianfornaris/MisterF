import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectedBrowserAnswer } from '../../src/server/auth/signupBotTrap.js';

/**
 * Proves `SIGNUP_BROWSER_CHECK_MODE=enforce` actually rejects.
 *
 * It has its own file because the mode is read from the environment when the
 * config module loads, so it cannot be changed inside a booted server. Without
 * this, flipping the switch in production could silently do nothing — the
 * failure that would be discovered only by an attack getting through.
 */

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalCheckMode = process.env.SIGNUP_BROWSER_CHECK_MODE;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-signup-enforce-'));
  process.env.APP_BASE_URL = 'http://127.0.0.1';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'enforce.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
  process.env.SIGNUP_BROWSER_CHECK_MODE = 'enforce';
  vi.resetModules();

  const serverModule = await import('../../src/server/server.js');
  server = serverModule.server;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  restoreEnvValue('APP_BASE_URL', originalAppBaseUrl);
  restoreEnvValue('DATABASE_PATH', originalDatabasePath);
  restoreEnvValue('ENV_FILE', originalEnvFile);
  restoreEnvValue('NODE_ENV', originalNodeEnv);
  restoreEnvValue('APP_SESSION_SECRET', originalSessionSecret);
  restoreEnvValue('SIGNUP_BROWSER_CHECK_MODE', originalCheckMode);
});

describe('signup browser checks under enforce', () => {
  it('rejects a client that never answered the challenge', async () => {
    const email = 'enforced-no-answer@example.com';
    const response = await submitSignup({ answer: '', email, interaction: '' });

    expect(response.status).toBe(422);
    await expect(userExists(email)).resolves.toBe(false);
  });

  it('rejects a client that answered but never touched the form', async () => {
    const stamp = await agedStamp();
    const email = 'enforced-untouched@example.com';
    const response = await submitSignup({
      answer: expectedBrowserAnswer(stamp),
      email,
      interaction: '',
      stamp,
    });

    expect(response.status).toBe(422);
    await expect(userExists(email)).resolves.toBe(false);
  });

  it('lets a real browser through to the rest of signup', async () => {
    const stamp = await agedStamp();
    const response = await submitSignup({
      answer: expectedBrowserAnswer(stamp),
      email: 'enforced-real-browser@example.com',
      interaction: '1',
      stamp,
    });

    // Stops at the unconfigured mailer, which is past every bot check.
    expect(response.status).toBe(503);
  });
});

async function agedStamp(): Promise<string> {
  const { createSignupFormStamp } = await import(
    '../../src/server/auth/signupBotTrap.js'
  );
  return createSignupFormStamp(Date.now() - 30_000);
}

async function submitSignup(input: {
  answer: string;
  email: string;
  interaction: string;
  stamp?: string;
}): Promise<Response> {
  const page = await fetch(`${baseUrl}/signup`, { redirect: 'manual' });
  const html = await page.text();
  const csrfToken = html.match(/name="_csrf" value="([^"]+)"/)?.[1] ?? '';
  const stamp = input.stamp ?? (await agedStamp());

  return fetch(`${baseUrl}/signup`, {
    body: new URLSearchParams({
      _csrf: csrfToken,
      confirmPassword: 'a-long-enough-password',
      email: input.email,
      fullName: 'Test Person',
      password: 'a-long-enough-password',
      returnTo: '/',
      signupBrowserAnswer: input.answer,
      signupFormStamp: stamp,
      signupInteraction: input.interaction,
      website: '',
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    redirect: 'manual',
  });
}

async function userExists(email: string): Promise<boolean> {
  const { findUserByEmail, normalizeEmail } = await import(
    '../../src/server/auth/repository.js'
  );
  return Boolean(findUserByEmail(normalizeEmail(email)));
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
