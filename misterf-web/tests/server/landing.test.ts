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
    expect(html).toContain('/signup?returnTo=');
    // The app shell must not leak into the public page.
    expect(html).not.toContain('class="app-shell"');
    expect(html).not.toContain('undefined');
  });

  it('sends the primary call to action to activity creation, not the chat', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    // "Create your first activity" has to end at the activity editor. Without
    // returnTo the visitor signs up and lands on `/`, the tutor chat.
    expect(html).toContain('href="/signup?returnTo=%2Fquizzes%2Fnew"');
    expect(html).not.toContain('href="/signup"');
  });

  it('carries the visitor through signup to the activity editor', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'landing-cta@example.com',
      emailVerified: true,
      fullName: 'Landing CTA',
      provider: 'google',
      providerSubject: 'landing-cta',
    });
    const profile = createProfile({
      instructionLanguage: 'en',
      name: 'CTA profile',
      profileOnboardingCompleted: true,
      userId: user.id,
    });
    const cookie = await createAuthenticatedCookie(user.id, profile.id);

    // An already-signed-in visitor must be passed straight through rather than
    // shown a signup form.
    const response = await fetch(`${baseUrl}/signup?returnTo=%2Fquizzes%2Fnew`, {
      headers: { cookie },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/quizzes/new');
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

  it('serves the landing in Haitian Creole', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'ht' },
    });
    const html = await response.text();

    expect(html).toContain('<html lang="ht">');
    expect(html).toContain('Pou pwofesè ak titè anglè endepandan');
    // Offering the language in the switcher and then serving English is worse
    // than not offering it: this asserts the page really changes.
    expect(html).not.toContain('For independent English teachers and tutors');
  });

  it('serves each language edition at its own URL, whatever the browser asks for', async () => {
    // The point of an edition URL is that the path wins: a crawler sending
    // English headers must still get Spanish from /es, or it can only ever
    // index one of the three.
    const spanish = await fetch(`${baseUrl}/es`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const spanishHtml = await spanish.text();

    expect(spanish.status).toBe(200);
    expect(spanishHtml).toContain('<html lang="es">');
    expect(spanishHtml).toContain('Para profesores y tutores independientes de inglés');
    expect(spanishHtml).toContain('<link rel="canonical" href="https://misterf.test/es">');
    // And the choice follows the visitor into the app they sign up for.
    expect(spanish.headers.get('set-cookie')).toContain('misterf_lang=es');

    const creole = await fetch(`${baseUrl}/ht`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const creoleHtml = await creole.text();

    expect(creoleHtml).toContain('<html lang="ht">');
    expect(creoleHtml).toContain('Pou pwofesè ak titè anglè endepandan');
    expect(creoleHtml).toContain('<link rel="canonical" href="https://misterf.test/ht">');
  });

  it('keeps /en from competing with the root for the English index entry', async () => {
    const response = await fetch(`${baseUrl}/en`, {
      headers: { 'Accept-Language': 'es-ES,es;q=0.9' },
    });
    const html = await response.text();

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<link rel="canonical" href="https://misterf.test/">');
  });

  it('cross-links every edition with reciprocal hreflang', async () => {
    for (const path of ['/', '/es', '/ht', '/en']) {
      const html = await (await fetch(`${baseUrl}${path}`)).text();

      expect(html).toContain('<link rel="alternate" hreflang="en" href="https://misterf.test/">');
      expect(html).toContain('<link rel="alternate" hreflang="es" href="https://misterf.test/es">');
      expect(html).toContain('<link rel="alternate" hreflang="ht" href="https://misterf.test/ht">');
      expect(html).toContain(
        '<link rel="alternate" hreflang="x-default" href="https://misterf.test/">',
      );
    }
  });

  it('declares that the root varies by language, and switches by URL', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    expect(response.headers.get('vary')).toContain('Accept-Language');
    // The switcher has to move the visitor to a real URL; `?lang=` reloads the
    // same one, which a crawler cannot follow and a visitor cannot forward.
    expect(html).toContain('href="/es"');
    expect(html).toContain('href="/ht"');
    expect(html).not.toContain('href="/?lang=');
  });

  it('sends a signed-in visitor from a language edition to the app', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'landing-edition@example.com',
      emailVerified: true,
      fullName: 'Landing Edition',
      provider: 'google',
      providerSubject: 'landing-edition',
    });
    const profile = createProfile({
      instructionLanguage: 'en',
      name: 'Edition profile',
      profileOnboardingCompleted: true,
      userId: user.id,
    });
    const cookie = await createAuthenticatedCookie(user.id, profile.id);

    const response = await fetch(`${baseUrl}/es`, {
      headers: { cookie },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
  });

  it('gives a crawler that states no language the default edition', async () => {
    // Express negotiation returns the first supported locale for a request with
    // no Accept-Language header, which is how the root ended up canonicalising
    // to /es for crawlers and leaving English behind /en.
    const response = await fetch(baseUrl);
    const html = await response.text();

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<link rel="canonical" href="https://misterf.test/">');
  });

  it('answers the objection that the product is only for after class', async () => {
    // The headline promises one cycle — homework, then the next class — and
    // stays that way deliberately. The flexibility is said here instead, so a
    // teacher who works in the other direction finds it before leaving.
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = await response.text();

    expect(html).toContain('Do I have to use it after class?');
    expect(html).toContain('before a lesson to see where the difficulty will be');
    // The view renders a fixed range of FAQ keys, so a question added to the
    // catalogs without widening it would silently never render.
    expect(html).toContain('How many students can I have?');
  });

  it('shares each edition under a title in that edition’s language', async () => {
    // `og:title` is the first line of the WhatsApp preview card, and it comes
    // from the page <title>. The application name inside it was a hardcoded
    // Spanish constant, so the English and Creole editions of a page whose
    // pitch is that it speaks the teacher's language shared as
    // "Mister F · Mr. F, tutor de inglés".
    const editions: Array<[string, string]> = [
      ['/', 'Mister F · Mr. F, English tutor'],
      ['/es', 'Mister F · Mr. F, tutor de inglés'],
      ['/ht', 'Mister F · Mr. F, titè anglè'],
    ];

    for (const [path, expectedTitle] of editions) {
      const response = await fetch(`${baseUrl}${path}`);
      const html = await response.text();

      expect(html).toContain(`<title>${expectedTitle}</title>`);
      expect(html).toContain(`<meta property="og:title" content="${expectedTitle}">`);
    }
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
    // No dead link. The step-3 mockup prints a share URL as illustration, so
    // this asserts the absence of a real one rather than of the string.
    expect(html).not.toContain('href="/resources/shared/');
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

describe('shared resource previews', () => {
  it('gives a shared activity its own preview card, kept out of the index', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createQuiz,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'share-preview@example.com',
      emailVerified: true,
      fullName: 'Share Preview',
      provider: 'google',
      providerSubject: 'share-preview',
    });
    const profile = createProfile({
      instructionLanguage: 'en',
      name: 'Preview profile',
      profileOnboardingCompleted: true,
      userId: owner.id,
    });
    const quiz = createQuiz({
      description: 'Book an appointment over the phone.',
      instructions: '',
      level: 'A2',
      profileId: profile.id,
      quiz: { blocks: [], title: 'Clinic call' },
      sharedVia: 'link',
      targetTopic: '',
      title: 'Clinic call',
      userId: owner.id,
    });
    const shareLink = getOrCreateResourceShareLink(quiz.id);

    const response = await fetch(`${baseUrl}/resources/shared/${shareLink.id}`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = await response.text();

    // The card a whole class sees when a teacher pastes the link.
    expect(html).toContain('<meta property="og:title" content="Clinic call">');
    expect(html).toContain(
      'content="Quiz · A2 — Book an appointment over the phone."',
    );
    expect(html).toContain('<meta property="og:image"');
    expect(html).toContain(
      `<meta property="og:url" content="https://misterf.test/resources/shared/${shareLink.id}">`,
    );
    // Public by design, but not something a stranger should find in search.
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
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
    expect(body).toContain('Allow: /es');
    expect(body).toContain('Allow: /ht');
    // Crawlable so the noindex tag on those pages can actually be read, and so
    // link-preview bots do not refuse the URL.
    expect(body).toContain('Allow: /resources/shared/');
  });

  it('serves a sitemap covering the public pages', async () => {
    const response = await fetch(`${baseUrl}/sitemap.xml`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('xml');
    expect(body).toContain('<loc>https://misterf.test/</loc>');
    expect(body).toContain('<loc>https://misterf.test/es</loc>');
    expect(body).toContain('<loc>https://misterf.test/ht</loc>');
    expect(body).toContain('<loc>https://misterf.test/privacy</loc>');
    expect(body).toContain('<loc>https://misterf.test/terms</loc>');
    expect(body).toContain(
      '<xhtml:link rel="alternate" hreflang="es" href="https://misterf.test/es"/>',
    );
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
