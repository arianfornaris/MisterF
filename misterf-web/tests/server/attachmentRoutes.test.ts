import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Extraction is mocked: processing an attachment runs a real model call, and
 * tests must never do that. Everything under test here — validation, staging,
 * ownership, approval, SSRF — happens either side of it.
 */
vi.mock('../../src/server/services/attachmentExtraction.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/server/services/attachmentExtraction.js')
  >('../../src/server/services/attachmentExtraction.js');

  return {
    ...actual,
    extractAttachmentText: vi.fn(async () => ({
      text: 'Extracted worksheet contents.',
      textIsDescription: true,
      truncated: false,
    })),
  };
});

vi.mock('../../src/server/services/creditGate.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/server/services/creditGate.js')
  >('../../src/server/services/creditGate.js');

  return {
    ...actual,
    getCreditCheckedOpenRouterApiKeyForUser: vi.fn(async () => 'test-key'),
  };
});

/**
 * Route coverage for the attachment endpoints. None of these run inference:
 * staging happens before any model call, which is exactly why the guards here
 * are worth asserting — a file that gets past them costs credit later.
 */

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let server: Server;
let baseUrl: string;
let cookie: string;
let csrfToken: string;

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-attachments-'));
  process.env.APP_BASE_URL = 'http://127.0.0.1';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'attachments.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
  vi.resetModules();

  const serverModule = await import('../../src/server/server.js');
  server = serverModule.server;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const { createExternalUser } = await import('../../src/server/auth/repository.js');
  const { createProfile } = await import('../../src/server/db/repository.js');

  const user = createExternalUser({
    email: 'attachment-owner@example.com',
    emailVerified: true,
    fullName: 'Attachment Owner',
    provider: 'google',
    providerSubject: 'attachment-owner',
  });
  const profile = createProfile({ name: 'Owner profile', userId: user.id });
  cookie = await createAuthenticatedCookie(user.id, profile.id);

  const page = await fetch(`${baseUrl}/quizzes/new`, { headers: { cookie } });
  csrfToken = extractCsrfToken(await page.text());
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  restoreEnvValue('APP_BASE_URL', originalAppBaseUrl);
  restoreEnvValue('APP_SESSION_SECRET', originalSessionSecret);
  restoreEnvValue('DATABASE_PATH', originalDatabasePath);
  restoreEnvValue('ENV_FILE', originalEnvFile);
  restoreEnvValue('NODE_ENV', originalNodeEnv);
});

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function extractCsrfToken(html: string): string {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

async function createAuthenticatedCookie(
  userId: string,
  profileId: string,
): Promise<string> {
  const { createSession } = await import('../../src/server/auth/repository.js');
  const { activeProfileCookieName } = await import('../../src/server/auth/profiles.js');
  const {
    createSessionCookie,
    sessionCookieName,
  } = await import('../../src/server/auth/session.js');

  const session = createSessionCookie();
  createSession({
    expiresAt: session.expiresAt,
    tokenHash: session.tokenHash,
    userId,
  });

  return [
    `${sessionCookieName}=${encodeURIComponent(session.token)}`,
    `${activeProfileCookieName}=${encodeURIComponent(profileId)}`,
  ].join('; ');
}

function uploadPng(
  bytes: Buffer,
  overrides: { contentType?: string; fileName?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  return fetch(`${baseUrl}/attachments/process`, {
    body: new Uint8Array(bytes),
    headers: {
      'content-type': overrides.contentType ?? 'image/png',
      cookie,
      'x-attachment-filename': overrides.fileName ?? 'worksheet.png',
      'x-csrf-token': csrfToken,
      ...overrides.headers,
    },
    method: 'POST',
    redirect: 'manual',
  });
}

async function samplePng(size = 64): Promise<Buffer> {
  return sharp({
    create: {
      background: { b: 200, g: 150, r: 100 },
      channels: 3,
      height: size,
      width: size,
    },
  })
    .png()
    .toBuffer();
}

describe('POST /attachments/process', () => {
  it('processes a valid image and returns it for review, unapproved', async () => {
    const response = await uploadPng(await samplePng());

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.attachment.sourceType).toBe('image');
    expect(payload.attachment.displayName).toBe('worksheet.png');
    expect(typeof payload.attachment.id).toBe('string');
    // The review step exists to show this; withholding it would make the
    // approval meaningless.
    expect(payload.attachment.text).toBe('Extracted worksheet contents.');
    expect(payload.attachment.approved).toBe(false);
  });

  it('never returns the raw file back to the browser', async () => {
    const response = await uploadPng(await samplePng());
    const payload = await response.json();

    expect(payload.attachment).not.toHaveProperty('bytes');
    expect(JSON.stringify(payload)).not.toContain('"type":"Buffer"');
  });

  it('rejects a request without a CSRF token', async () => {
    const response = await fetch(`${baseUrl}/attachments/process`, {
      body: new Uint8Array(await samplePng()),
      headers: { 'content-type': 'image/png', cookie },
      method: 'POST',
      redirect: 'manual',
    });

    expect(response.status).toBe(403);
  });

  it('rejects an unauthenticated upload', async () => {
    const response = await fetch(`${baseUrl}/attachments/process`, {
      body: new Uint8Array(await samplePng()),
      headers: { 'content-type': 'image/png', 'x-csrf-token': csrfToken },
      method: 'POST',
      redirect: 'manual',
    });

    expect(response.status).toBe(401);
  });

  it('rejects content whose bytes contradict the declared type', async () => {
    const response = await fetch(`${baseUrl}/attachments/process`, {
      body: new Uint8Array(Buffer.from('%PDF-1.7 pretending to be a png')),
      headers: {
        'content-type': 'image/png',
        cookie,
        'x-attachment-filename': 'trap.png',
        'x-csrf-token': csrfToken,
      },
      method: 'POST',
      redirect: 'manual',
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('content_mismatch');
  });

  it('rejects a content type the upload parser does not accept', async () => {
    const response = await fetch(`${baseUrl}/attachments/process`, {
      body: 'plain text is not an accepted attachment',
      headers: {
        'content-type': 'text/plain',
        cookie,
        'x-attachment-filename': 'notes.txt',
        'x-csrf-token': csrfToken,
      },
      method: 'POST',
      redirect: 'manual',
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('empty_file');
  });
});

describe('POST /attachments/process-url', () => {
  it('refuses an address that resolves to the loopback interface', async () => {
    const response = await fetch(`${baseUrl}/attachments/process-url`, {
      body: new URLSearchParams({ _csrf: csrfToken, url: baseUrl }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
      method: 'POST',
      redirect: 'manual',
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('url_blocked');
  });

  it('refuses a non-http scheme', async () => {
    const response = await fetch(`${baseUrl}/attachments/process-url`, {
      body: new URLSearchParams({ _csrf: csrfToken, url: 'file:///etc/passwd' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
      method: 'POST',
      redirect: 'manual',
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('url_blocked');
  });
});

describe('DELETE /attachments/:id', () => {
  it('discards a staged attachment the caller owns', async () => {
    const staged = await (await uploadPng(await samplePng())).json();

    const removed = await fetch(
      `${baseUrl}/attachments/${staged.attachment.id}`,
      {
        headers: { cookie, 'x-csrf-token': csrfToken },
        method: 'DELETE',
        redirect: 'manual',
      },
    );
    expect(removed.status).toBe(204);

    const again = await fetch(
      `${baseUrl}/attachments/${staged.attachment.id}`,
      {
        headers: { cookie, 'x-csrf-token': csrfToken },
        method: 'DELETE',
        redirect: 'manual',
      },
    );
    expect(again.status).toBe(404);
  });

  it('will not let another account discard a staged attachment', async () => {
    const staged = await (await uploadPng(await samplePng())).json();

    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const stranger = createExternalUser({
      email: 'attachment-stranger@example.com',
      emailVerified: true,
      fullName: 'Stranger',
      provider: 'google',
      providerSubject: 'attachment-stranger',
    });
    const strangerProfile = createProfile({
      name: 'Stranger profile',
      userId: stranger.id,
    });
    const strangerCookie = await createAuthenticatedCookie(
      stranger.id,
      strangerProfile.id,
    );

    const response = await fetch(
      `${baseUrl}/attachments/${staged.attachment.id}`,
      {
        headers: { cookie: strangerCookie, 'x-csrf-token': csrfToken },
        method: 'DELETE',
        redirect: 'manual',
      },
    );

    expect(response.status).toBe(404);
  });
});

describe('the attach control on AI authoring pages', () => {
  it.each([
    ['/quizzes/new'],
    ['/roleplays/new'],
    ['/practice-guides/new'],
  ])('renders on %s', async (route) => {
    const response = await fetch(`${baseUrl}${route}`, { headers: { cookie } });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('data-attachment-picker');
    expect(html).toContain('name="attachmentIds"');
  });
});
