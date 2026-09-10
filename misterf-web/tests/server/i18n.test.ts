import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-i18n-'));
  process.env.APP_BASE_URL = 'http://127.0.0.1';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'i18n.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
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

describe('UI localization', () => {
  it('renders the home shell in Spanish when Accept-Language prefers Spanish', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'es-ES,es;q=0.9' },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('Iniciar sesión');
    expect(html).not.toContain('undefined');
  });

  it('renders the home shell in English when Accept-Language prefers English', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Sign in');
    expect(html).not.toContain('Iniciar sesión');
  });

  it('falls back to English when Accept-Language matches no supported locale', async () => {
    const response = await fetch(baseUrl, {
      headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
    });
    const html = await response.text();

    expect(html).toContain('<html lang="en">');
  });

  it('localizes the login page in both languages', async () => {
    const spanish = await fetch(`${baseUrl}/login`, {
      headers: { 'Accept-Language': 'es-ES,es;q=0.9' },
    });
    const spanishHtml = await spanish.text();
    expect(spanishHtml).toContain('<html lang="es">');
    expect(spanishHtml).toContain('Entrar');
    expect(spanishHtml).toContain('¿No tienes cuenta?');

    const english = await fetch(`${baseUrl}/login`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const englishHtml = await english.text();
    expect(englishHtml).toContain('<html lang="en">');
    expect(englishHtml).toContain('Don’t have an account?');
    expect(englishHtml).not.toContain('¿No tienes cuenta?');
  });

  it('honors an explicit ?lang override via a cookie and clean redirect', async () => {
    const response = await fetch(`${baseUrl}/?lang=es`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
    expect(response.headers.get('set-cookie')).toContain('misterf_lang=es');
  });
});

describe('dates and labels follow the profile language (Roadmap V3 §2.8)', () => {
  async function createCookieForProfile(instructionLanguage: 'en' | 'ht'): Promise<string> {
    const { createExternalUser, createSession } = await import(
      '../../src/server/auth/repository.js'
    );
    const { createPracticeGuide, createProfile } = await import(
      '../../src/server/db/repository.js'
    );
    const { activeProfileCookieName } = await import('../../src/server/auth/profiles.js');
    const { createSessionCookie, sessionCookieName } = await import(
      '../../src/server/auth/session.js'
    );

    const user = createExternalUser({
      email: `dates-${instructionLanguage}@example.com`,
      emailVerified: true,
      fullName: `Dates ${instructionLanguage}`,
      provider: 'google',
      providerSubject: `dates-${instructionLanguage}`,
    });
    const profile = createProfile({
      instructionLanguage,
      name: `Profile ${instructionLanguage}`,
      userId: user.id,
    });
    createPracticeGuide({
      description: 'Guide used to render a relative date.',
      profileId: profile.id,
      title: 'Past simple at work',
      tutorInstructions: 'Practice the past simple.',
      userId: user.id,
    });

    const session = createSessionCookie();
    createSession({ expiresAt: session.expiresAt, tokenHash: session.tokenHash, userId: user.id });
    return [
      `${sessionCookieName}=${encodeURIComponent(session.token)}`,
      `${activeProfileCookieName}=${encodeURIComponent(profile.id)}`,
    ].join('; ');
  }

  it('renders the catalog in English with no Spanish dates or type labels', async () => {
    const cookie = await createCookieForProfile('en');
    const response = await fetch(`${baseUrl}/resources`, { headers: { cookie } });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('Practice Guide');
    expect(html).toContain('just now');
    expect(html).not.toMatch(/\bhace\b/);
    expect(html).not.toContain('Guía de Práctica');
  });

  it('renders Haitian Creole dates from the catalog, not in English', async () => {
    const cookie = await createCookieForProfile('ht');
    const response = await fetch(`${baseUrl}/resources`, { headers: { cookie } });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('kounye a');
    expect(html).not.toContain('just now');
    expect(html).not.toMatch(/\bhace\b/);
  });
});
