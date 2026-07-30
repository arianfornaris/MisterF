import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The public landing page owns `/` for visitors without a session, which is the
 * one route in the app that used to mean "chat" for everybody. These tests pin
 * the split (landing for guests, app for sessions), the guest chat entry that
 * replaces the old anonymous `/`, and the crawler surfaces.
 */

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalLandingDemoEmail = process.env.LANDING_DEMO_EMAIL;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-landing-'));
  process.env.APP_BASE_URL = 'https://misterf.test';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'landing.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
  process.env.LANDING_DEMO_EMAIL = 'landing-examples@example.com';
  vi.resetModules();

  const serverModule = await import('../../src/server/server.js');
  server = serverModule.server;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  restoreEnvValue('APP_BASE_URL', originalAppBaseUrl);
  restoreEnvValue('DATABASE_PATH', originalDatabasePath);
  restoreEnvValue('ENV_FILE', originalEnvFile);
  restoreEnvValue('LANDING_DEMO_EMAIL', originalLandingDemoEmail);
  restoreEnvValue('NODE_ENV', originalNodeEnv);
  restoreEnvValue('APP_SESSION_SECRET', originalSessionSecret);
});

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe('public landing page', () => {
  it('renders the landing at the root for anonymous visitors', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'manual',
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('id="landing-main"');
    expect(html).toContain('For independent English teachers and tutors');
    expect(html).toContain('href="/signup"');
    // The app shell must not leak into the public page.
    expect(html).not.toContain('class="app-shell"');
    expect(html).not.toContain('undefined');
  });

  it('ships its own stylesheet, with no app theme and no script', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    expect(html).toContain('/public/landing.css');
    // The landing opts out of the app theme on purpose: a first impression
    // read on mobile data should not pay for Bootstrap, an icon font, and a
    // script it never uses. The FAQ is native <details>, so nothing runs.
    expect(html).not.toContain('bootswatch');
    expect(html).not.toContain('bootstrap-icons');
    expect(html).not.toContain('<script');
  });

  it('localizes the landing', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'es-ES,es;q=0.9' },
    });
    const html = await response.text();

    expect(html).toContain('<html lang="es">');
    expect(html).toContain('Para profesores y tutores independientes de inglés');
    expect(html).not.toContain('For independent English teachers and tutors');
  });

  it('falls back to English copy for a locale without landing translations', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'ht' },
    });
    const html = await response.text();

    expect(html).toContain('<html lang="ht">');
    expect(html).toContain('For independent English teachers and tutors');
  });

  it('emits the description, canonical, and Open Graph tags', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<link rel="canonical" href="https://misterf.test/">');
    expect(html).toContain('<meta property="og:url" content="https://misterf.test/">');
    expect(html).toContain(
      '<meta property="og:image" content="https://misterf.test/public/brand/share-card.png">',
    );
  });

  it('hides the demo call to action while no example activity is seeded', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = await response.text();

    expect(html).not.toContain('Example activity');
    expect(html).not.toContain('/resources/shared/');
  });

  it('offers a seeded example activity from the demo account', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createQuiz,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');
    const { landingDemoActivities } = await import(
      '../../src/server/landing/demoActivities.js'
    );

    const demoUser = createExternalUser({
      email: 'landing-examples@example.com',
      emailVerified: true,
      fullName: 'Mister F examples',
      provider: 'google',
      providerSubject: 'landing-examples',
    });
    const demoProfile = createProfile({
      instructionLanguage: 'en',
      name: 'Examples',
      userId: demoUser.id,
    });
    const [first] = landingDemoActivities;
    const quiz = createQuiz({
      description: first.draft.description,
      id: `landing-demo-${first.slug}`,
      instructions: first.draft.instructions,
      level: first.draft.level,
      profileId: demoProfile.id,
      quiz: first.draft,
      sharedVia: 'link',
      targetTopic: first.draft.targetTopic,
      title: first.draft.title,
      userId: demoUser.id,
    });
    const shareLink = getOrCreateResourceShareLink(quiz.id);

    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = await response.text();

    expect(html).toContain(`/resources/shared/${shareLink.id}`);
    expect(html).toContain(first.draft.title);
    expect(html).toContain('Example activity');

    // And the visitor can actually open it without an account.
    const shared = await fetch(`${baseUrl}/resources/shared/${shareLink.id}`, {
      redirect: 'manual',
    });
    expect(shared.status).toBe(200);
    await expect(shared.text()).resolves.toContain(first.draft.title);
  });

  it('keeps the root as the app for an authenticated session', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'landing-session@example.com',
      emailVerified: true,
      fullName: 'Landing Session',
      provider: 'google',
      providerSubject: 'landing-session',
    });
    const profile = createProfile({
      instructionLanguage: 'en',
      name: 'Landing profile',
      userId: user.id,
    });
    const cookie = await createAuthenticatedCookie(user.id, profile.id);

    const response = await fetch(baseUrl, {
      headers: { cookie },
      redirect: 'manual',
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('class="app-shell"');
    expect(html).not.toContain('id="landing-main"');
  });

  it('keeps guest chat reachable at /chat', async () => {
    const response = await fetch(`${baseUrl}/chat`, { redirect: 'manual' });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('class="app-shell"');
  });
});

describe('crawler surfaces', () => {
  it('serves robots.txt with the sitemap reference', async () => {
    const response = await fetch(`${baseUrl}/robots.txt`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('Sitemap: https://misterf.test/sitemap.xml');
    expect(body).toContain('Disallow: /');
  });

  it('serves a sitemap covering the public pages', async () => {
    const response = await fetch(`${baseUrl}/sitemap.xml`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('xml');
    expect(body).toContain('<loc>https://misterf.test/</loc>');
    expect(body).toContain('<loc>https://misterf.test/privacy</loc>');
    expect(body).toContain('<loc>https://misterf.test/terms</loc>');
  });
});

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
