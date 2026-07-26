import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultProfileModelTier,
  normalizeProfileModelTier,
} from '../../src/server/profiles/modelTier.js';

const MODEL_ENV_VARS = [
  'LLM_MODEL',
  'LLM_MODEL_LITE',
  'LLM_MODEL_REGULAR',
  'LLM_MODEL_ADVANCED',
] as const;
const STORAGE_ENV_VARS = [
  'DO_SPACES_ENDPOINT',
  'USER_FILE_STORAGE_BUCKET',
  'USER_FILE_STORAGE_PROVIDER',
  'USER_FILE_STORAGE_PUBLIC_BASE_URL',
  'USER_FILE_STORAGE_REGION',
  'USER_FILE_STORAGE_ROOT_PREFIX',
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const name of [...MODEL_ENV_VARS, ...STORAGE_ENV_VARS, 'ENV_FILE', 'NODE_ENV']) {
  originalEnv[name] = process.env[name];
}

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  vi.resetModules();
});

async function loadEnvWith(
  vars: Partial<Record<(typeof MODEL_ENV_VARS)[number], string>>,
) {
  for (const name of MODEL_ENV_VARS) {
    delete process.env[name];
  }
  Object.assign(process.env, vars);
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();
  return import('../../src/server/config/env.js');
}

describe('normalizeProfileModelTier', () => {
  it('accepts every active ladder tier', () => {
    expect(normalizeProfileModelTier('lite')).toBe('lite');
    expect(normalizeProfileModelTier('regular')).toBe('regular');
    expect(normalizeProfileModelTier('advanced')).toBe('advanced');
  });

  it('maps the retired max tier to advanced', () => {
    expect(normalizeProfileModelTier('max')).toBe('advanced');
  });

  it('defaults unknown values to lite', () => {
    expect(defaultProfileModelTier).toBe('lite');
    expect(normalizeProfileModelTier(undefined)).toBe('lite');
    expect(normalizeProfileModelTier(null)).toBe('lite');
    expect(normalizeProfileModelTier('')).toBe('lite');
    expect(normalizeProfileModelTier('ultra')).toBe('lite');
    expect(normalizeProfileModelTier(42)).toBe('lite');
  });
});

describe('model env fallback chain', () => {
  it('uses per-tier variables when all are set', async () => {
    const { env } = await loadEnvWith({
      LLM_MODEL_LITE: 'vendor/lite-model',
      LLM_MODEL_REGULAR: 'vendor/regular-model',
      LLM_MODEL_ADVANCED: 'vendor/advanced-model',
    });

    expect(env.llmLiteModel).toBe('vendor/lite-model');
    expect(env.llmRegularModel).toBe('vendor/regular-model');
    expect(env.llmAdvancedModel).toBe('vendor/advanced-model');
  });

  it('falls back to LLM_MODEL for every tier', async () => {
    const { env } = await loadEnvWith({
      LLM_MODEL: 'vendor/single-model',
    });

    expect(env.llmLiteModel).toBe('vendor/single-model');
    expect(env.llmRegularModel).toBe('vendor/single-model');
    expect(env.llmAdvancedModel).toBe('vendor/single-model');
  });

  it('has the three-model Google portfolio as its built-in default', async () => {
    const { env } = await loadEnvWith({});

    expect(env.llmLiteModel).toBe('google/gemini-3.5-flash-lite');
    expect(env.llmRegularModel).toBe('google/gemini-3.6-flash');
    expect(env.llmAdvancedModel).toBe('google/gemini-3.1-pro-preview');
  });
});

describe('user file storage env defaults', () => {
  it('uses the development Spaces bucket outside production', async () => {
    for (const name of STORAGE_ENV_VARS) {
      delete process.env[name];
    }
    process.env.ENV_FILE = '/dev/null';
    process.env.NODE_ENV = 'development';
    vi.resetModules();

    const { env } = await import('../../src/server/config/env.js');

    expect(env.userFileStorageProvider).toBe('spaces');
    expect(env.userFileStorageBucket).toBe('misterf.us-files-dev');
    expect(env.userFileStorageRegion).toBe('atl1');
    expect(env.userFileStorageRootPrefix).toBe('misterf');
    expect(env.doSpacesEndpoint).toBe('https://atl1.digitaloceanspaces.com');
  });

  it('uses the production Spaces bucket in production', async () => {
    for (const name of STORAGE_ENV_VARS) {
      delete process.env[name];
    }
    process.env.ENV_FILE = '/dev/null';
    process.env.NODE_ENV = 'production';
    vi.resetModules();

    const { env } = await import('../../src/server/config/env.js');

    expect(env.userFileStorageBucket).toBe('misterf.us-files');
  });

  it('lets storage env variables override the defaults', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.NODE_ENV = 'development';
    process.env.USER_FILE_STORAGE_BUCKET = 'custom-bucket';
    process.env.USER_FILE_STORAGE_REGION = 'nyc3';
    process.env.USER_FILE_STORAGE_ROOT_PREFIX = 'custom-root';
    process.env.USER_FILE_STORAGE_PROVIDER = 'local';
    process.env.USER_FILE_STORAGE_PUBLIC_BASE_URL = 'https://media.example.test';
    process.env.DO_SPACES_ENDPOINT = 'https://custom.example.com';
    vi.resetModules();

    const { env } = await import('../../src/server/config/env.js');

    expect(env.userFileStorageProvider).toBe('local');
    expect(env.userFileStorageBucket).toBe('custom-bucket');
    expect(env.userFileStorageRegion).toBe('nyc3');
    expect(env.userFileStorageRootPrefix).toBe('custom-root');
    expect(env.userFileStoragePublicBaseUrl).toBe('https://media.example.test');
    expect(env.doSpacesEndpoint).toBe('https://custom.example.com');
  });
});

describe('getConfiguredModelId tier mapping', () => {
  it('maps each tier to its configured model', async () => {
    await loadEnvWith({
      LLM_MODEL_LITE: 'vendor/lite-model',
      LLM_MODEL_REGULAR: 'vendor/regular-model',
      LLM_MODEL_ADVANCED: 'vendor/advanced-model',
    });
    const { getConfiguredModelId } = await import(
      '../../src/server/services/llmTutor/providers.js'
    );

    expect(getConfiguredModelId({ modelTier: 'lite' })).toBe('vendor/lite-model');
    expect(getConfiguredModelId({ modelTier: 'regular' })).toBe('vendor/regular-model');
    expect(getConfiguredModelId({ modelTier: 'advanced' })).toBe('vendor/advanced-model');
    expect(getConfiguredModelId()).toBe('vendor/lite-model');
  });

  it('lets an explicit modelId override the tier', async () => {
    await loadEnvWith({
      LLM_MODEL_LITE: 'vendor/lite-model',
    });
    const { getConfiguredModelId } = await import(
      '../../src/server/services/llmTutor/providers.js'
    );

    expect(
      getConfiguredModelId({ modelId: 'vendor/explicit-model', modelTier: 'lite' }),
    ).toBe('vendor/explicit-model');
  });
});

describe('temperature policy', () => {
  it('omits temperature for every configured Gemini 3 tier', async () => {
    await loadEnvWith({
      LLM_MODEL_LITE: 'google/gemini-3.5-flash-lite',
      LLM_MODEL_REGULAR: 'google/gemini-3.6-flash',
      LLM_MODEL_ADVANCED: 'google/gemini-3.1-pro-preview',
    });
    const { shouldUseTemperature } = await import(
      '../../src/server/services/llmTutor/providers.js'
    );

    expect(shouldUseTemperature({ modelTier: 'lite' })).toBe(false);
    expect(shouldUseTemperature({ modelTier: 'regular' })).toBe(false);
    expect(shouldUseTemperature({ modelTier: 'advanced' })).toBe(false);
  });

  it('preserves the existing policy for older Gemini and GPT-5 models', async () => {
    await loadEnvWith({});
    const { shouldUseTemperature } = await import(
      '../../src/server/services/llmTutor/providers.js'
    );

    expect(shouldUseTemperature({ modelId: 'google/gemini-2.5-flash' })).toBe(true);
    expect(shouldUseTemperature({ modelId: 'openai/gpt-5-mini' })).toBe(false);
  });
});
