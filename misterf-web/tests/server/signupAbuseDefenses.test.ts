import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Covers the two frictionless signup defenses from roadmap v3 §2.7: the
 * honeypot/timing trap and the per-IP flood brake.
 *
 * This lives in its own file because the flood brake is module-level state
 * keyed by client address, and every request here arrives from 127.0.0.1. A
 * test that deliberately exhausts that bucket would starve any other signup
 * test sharing the process.
 */

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-signup-abuse-'));
  process.env.APP_BASE_URL = 'http://127.0.0.1';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'signup-abuse.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
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
});

describe('signup bot trap', () => {
  it('renders the decoy field off-screen and out of the tab order', async () => {
    const form = await renderSignupForm();

    expect(form.html).toContain('class="signup-trap"');
    expect(form.html).toContain('name="website"');
    expect(form.html).toContain('tabindex="-1"');
    expect(form.honeypotValue).toBe('');
    expect(form.stamp).not.toBe('');
  });

  it('rejects a submission that filled the decoy field', async () => {
    const email = 'honeypot-trip@example.com';
    const response = await submitSignup({
      email,
      stamp: await agedStamp(),
      website: 'https://example.com',
    });

    expect(response.status).toBe(422);
    await expect(userExists(email)).resolves.toBe(false);
  });

  it('rejects a submission posted faster than a person can fill the form', async () => {
    // The stamp comes straight from the rendered form, so the POST lands
    // milliseconds after the render — the shape of a replayed form.
    const form = await renderSignupForm();
    const email = 'too-fast@example.com';
    const response = await submitSignup({
      csrfToken: form.csrfToken,
      email,
      stamp: form.stamp,
    });

    expect(response.status).toBe(422);
    await expect(userExists(email)).resolves.toBe(false);
  });

  it('rejects a submission with no stamp at all', async () => {
    const email = 'no-stamp@example.com';
    const response = await submitSignup({ email, stamp: '' });

    expect(response.status).toBe(422);
    await expect(userExists(email)).resolves.toBe(false);
  });

  it('rejects a stamp whose age was tampered with', async () => {
    const { createSignupFormStamp } = await import(
      '../../src/server/auth/signupBotTrap.js'
    );
    const genuine = createSignupFormStamp(Date.now() - 5_000);
    const [, signature] = genuine.split('.');
    const email = 'forged-stamp@example.com';

    const response = await submitSignup({
      email,
      // A far older render time carrying the signature of a newer one.
      stamp: `${Date.now() - 600_000}.${signature}`,
    });

    expect(response.status).toBe(422);
    await expect(userExists(email)).resolves.toBe(false);
  });

  it('lets a normally filled form through to the rest of signup', async () => {
    const email = 'real-person@example.com';
    const response = await submitSignup({ email, stamp: await agedStamp() });

    // The mailer is unconfigured under test, so the request stops at the
    // verification email. Reaching that point is the assertion: the trap is
    // behind it, and it did not fire.
    expect(response.status).toBe(503);
    expect(response.status).not.toBe(422);
  });
});

describe('signup browser checks', () => {
  it('ships the challenge fields and the script that answers them', async () => {
    const form = await renderSignupForm();

    expect(form.html).toContain('data-signup-form');
    expect(form.html).toContain('name="signupBrowserAnswer"');
    expect(form.html).toContain('name="signupInteraction"');
    expect(form.html).toContain('entries/signup-');
  });

  it('accepts the answer a browser would compute from the stamp', async () => {
    const { evaluateBrowserExecution, expectedBrowserAnswer } = await import(
      '../../src/server/auth/signupBotTrap.js'
    );
    const stamp = await agedStamp();

    expect(
      evaluateBrowserExecution({
        answer: expectedBrowserAnswer(stamp),
        interacted: true,
        stamp,
      }),
    ).toEqual({ passed: true });
  });

  it.each([
    { answer: '', interacted: true, signal: 'browser_answer_missing' },
    { answer: 'f'.repeat(64), interacted: true, signal: 'browser_answer_invalid' },
    { answer: null, interacted: false, signal: 'no_human_interaction' },
  ])('reports $signal', async ({ answer, interacted, signal }) => {
    const { evaluateBrowserExecution, expectedBrowserAnswer } = await import(
      '../../src/server/auth/signupBotTrap.js'
    );
    const stamp = await agedStamp();

    expect(
      evaluateBrowserExecution({
        answer: answer ?? expectedBrowserAnswer(stamp),
        interacted,
        stamp,
      }),
    ).toEqual({ passed: false, signal });
  });

  /**
   * The whole point of shipping in report-only mode: a submission that fails
   * the browser checks is recorded, never turned away, until the
   * false-positive rate on real phones is known.
   */
  it('does not reject a submission that fails the checks while reporting', async () => {
    const email = 'no-js-client@example.com';
    const response = await submitSignup({ email, stamp: await agedStamp() });

    expect(response.status).not.toBe(422);
    expect(response.status).toBe(503);
  });
});

describe('signup flood brake', () => {
  /**
   * Runs last on purpose: it exhausts the per-address bucket the whole file
   * shares.
   */
  it('stops a burst of submissions from one address', async () => {
    const statuses: number[] = [];
    const stamp = await agedStamp();

    for (let attempt = 0; attempt < 41; attempt += 1) {
      const response = await submitSignup({
        email: `flood-${attempt}@example.com`,
        stamp,
      });
      statuses.push(response.status);
      await response.text();
    }

    expect(statuses.at(-1)).toBe(429);
    expect(statuses[0]).not.toBe(429);
  });
});

async function renderSignupForm(): Promise<{
  csrfToken: string;
  honeypotValue: string;
  html: string;
  stamp: string;
}> {
  const response = await fetch(`${baseUrl}/signup`, { redirect: 'manual' });
  expect(response.status).toBe(200);
  const html = await response.text();

  return {
    csrfToken: extractInputValue(html, '_csrf'),
    honeypotValue: extractInputValue(html, 'website'),
    html,
    stamp: extractInputValue(html, 'signupFormStamp'),
  };
}

/** A stamp old enough to clear the minimum fill time, without a real wait. */
async function agedStamp(): Promise<string> {
  const { createSignupFormStamp } = await import(
    '../../src/server/auth/signupBotTrap.js'
  );
  return createSignupFormStamp(Date.now() - 30_000);
}

async function submitSignup(input: {
  csrfToken?: string;
  email: string;
  stamp: string;
  website?: string;
}): Promise<Response> {
  const csrfToken = input.csrfToken ?? (await renderSignupForm()).csrfToken;

  return fetch(`${baseUrl}/signup`, {
    body: new URLSearchParams({
      _csrf: csrfToken,
      confirmPassword: 'a-long-enough-password',
      email: input.email,
      fullName: 'Test Person',
      password: 'a-long-enough-password',
      returnTo: '/',
      signupFormStamp: input.stamp,
      website: input.website ?? '',
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

function extractInputValue(html: string, name: string): string {
  const match = html.match(
    new RegExp(`name="${name}"[^>]*?value="([^"]*)"`),
  );
  return match?.[1] ?? '';
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
