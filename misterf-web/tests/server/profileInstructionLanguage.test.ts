import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  isInstructionLanguage,
  normalizeInstructionLanguage,
  resolveRequestInstructionLanguage,
} from '../../src/server/profiles/instructionLanguage.js';

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let repository: typeof import('../../src/server/db/repository.js');
let database: typeof import('../../src/server/db/database.js');

function insertUser(id: string): void {
  database
    .getDb()
    .prepare(
      `
        INSERT INTO users (id, email, full_name, password_hash, email_verified)
        VALUES (?, ?, ?, ?, 1)
      `,
    )
    .run(id, `${id}@example.com`, `User ${id}`, 'password-hash');
}

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'misterf-profile-language-'),
  );
  process.env.APP_BASE_URL = 'http://127.0.0.1';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'profile-language.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
  vi.resetModules();

  const migrator = await import('../../src/server/db/migrator.js');
  migrator.migrate();
  repository = await import('../../src/server/db/repository.js');
  database = await import('../../src/server/db/database.js');
});

afterAll(() => {
  database.closeDb();
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

describe('instruction language helpers', () => {
  it('accepts only supported languages', () => {
    expect(isInstructionLanguage('es')).toBe(true);
    expect(isInstructionLanguage('en')).toBe(true);
    expect(isInstructionLanguage('ht')).toBe(false);
    expect(isInstructionLanguage('')).toBe(false);
    expect(isInstructionLanguage(undefined)).toBe(false);
  });

  it('normalizes invalid values to the fallback', () => {
    expect(normalizeInstructionLanguage('en')).toBe('en');
    expect(normalizeInstructionLanguage('fr')).toBe('es');
    expect(normalizeInstructionLanguage(undefined, 'en')).toBe('en');
  });

  it('resolves the request language from Accept-Language negotiation', () => {
    const acceptsEnglish = {
      acceptsLanguages: () => 'en',
    } as unknown as Request;
    const acceptsNothing = {
      acceptsLanguages: () => false,
    } as unknown as Request;

    expect(resolveRequestInstructionLanguage(acceptsEnglish)).toBe('en');
    expect(resolveRequestInstructionLanguage(acceptsNothing)).toBe('es');
    expect(resolveRequestInstructionLanguage(acceptsNothing, 'en')).toBe('en');
  });
});

describe('profile instruction language persistence', () => {
  it('defaults new profiles to Spanish', () => {
    insertUser('user-default');
    const profile = repository.createProfile({
      name: 'Perfil',
      userId: 'user-default',
    });

    expect(profile.instructionLanguage).toBe('es');
  });

  it('persists an explicit instruction language', () => {
    insertUser('user-english');
    const profile = repository.createProfile({
      instructionLanguage: 'en',
      name: 'Profile',
      userId: 'user-english',
    });

    expect(profile.instructionLanguage).toBe('en');
    expect(
      repository.findProfileForUser(profile.id, 'user-english')
        ?.instructionLanguage,
    ).toBe('en');
  });

  it('seeds the first profile language through ensureUserHasProfile', () => {
    insertUser('user-seeded');
    const profile = repository.ensureUserHasProfile('user-seeded', 'en');

    expect(profile.instructionLanguage).toBe('en');
    expect(repository.ensureUserHasProfile('user-seeded', 'es').id).toBe(
      profile.id,
    );
  });

  it('updates the language and preserves it when omitted', () => {
    insertUser('user-updates');
    const profile = repository.createProfile({
      name: 'Perfil',
      userId: 'user-updates',
    });

    const switched = repository.updateProfile({
      description: profile.description,
      instructionLanguage: 'en',
      name: profile.name,
      profileId: profile.id,
      userId: 'user-updates',
    });
    expect(switched?.instructionLanguage).toBe('en');

    const untouched = repository.updateProfile({
      description: profile.description,
      name: 'Renamed',
      profileId: profile.id,
      userId: 'user-updates',
    });
    expect(untouched?.instructionLanguage).toBe('en');
    expect(untouched?.name).toBe('Renamed');
  });
});
