import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeProfileModelTier,
} from '../../src/server/profiles/modelTier.js';

const MODEL_ENV_VARS = [
  'LLM_MODEL',
  'LLM_MODEL_LITE',
  'LLM_MODEL_REGULAR',
  'LLM_MODEL_ADVANCED',
  'LLM_MODEL_MAX',
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const name of [...MODEL_ENV_VARS, 'ENV_FILE']) {
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
  it('accepts every ladder tier', () => {
    expect(normalizeProfileModelTier('lite')).toBe('lite');
    expect(normalizeProfileModelTier('regular')).toBe('regular');
    expect(normalizeProfileModelTier('advanced')).toBe('advanced');
    expect(normalizeProfileModelTier('max')).toBe('max');
  });

  it('coerces unknown values to regular', () => {
    expect(normalizeProfileModelTier(undefined)).toBe('regular');
    expect(normalizeProfileModelTier(null)).toBe('regular');
    expect(normalizeProfileModelTier('')).toBe('regular');
    expect(normalizeProfileModelTier('ultra')).toBe('regular');
    expect(normalizeProfileModelTier(42)).toBe('regular');
  });
});

describe('model env fallback chain', () => {
  it('uses per-tier variables when all are set', async () => {
    const { env } = await loadEnvWith({
      LLM_MODEL_LITE: 'vendor/lite-model',
      LLM_MODEL_REGULAR: 'vendor/regular-model',
      LLM_MODEL_ADVANCED: 'vendor/advanced-model',
      LLM_MODEL_MAX: 'vendor/max-model',
    });

    expect(env.llmLiteModel).toBe('vendor/lite-model');
    expect(env.llmRegularModel).toBe('vendor/regular-model');
    expect(env.llmAdvancedModel).toBe('vendor/advanced-model');
    expect(env.llmMaxModel).toBe('vendor/max-model');
  });

  it('falls back lite -> regular and advanced/max -> lower tiers', async () => {
    const { env } = await loadEnvWith({
      LLM_MODEL_REGULAR: 'vendor/regular-model',
    });

    expect(env.llmLiteModel).toBe('vendor/regular-model');
    expect(env.llmAdvancedModel).toBe('vendor/regular-model');
    expect(env.llmMaxModel).toBe('vendor/regular-model');
  });

  it('falls back to LLM_MODEL for every tier', async () => {
    const { env } = await loadEnvWith({
      LLM_MODEL: 'vendor/single-model',
    });

    expect(env.llmLiteModel).toBe('vendor/single-model');
    expect(env.llmRegularModel).toBe('vendor/single-model');
    expect(env.llmAdvancedModel).toBe('vendor/single-model');
    expect(env.llmMaxModel).toBe('vendor/single-model');
  });

  it('has a built-in default for every tier with no variables set', async () => {
    const { env } = await loadEnvWith({});

    expect(env.llmLiteModel).not.toBe('');
    expect(env.llmRegularModel).not.toBe('');
    expect(env.llmAdvancedModel).not.toBe('');
    expect(env.llmMaxModel).not.toBe('');
    expect(env.llmLiteModel).toBe(env.llmRegularModel);
  });
});

describe('getConfiguredModelId tier mapping', () => {
  it('maps each tier to its configured model', async () => {
    await loadEnvWith({
      LLM_MODEL_LITE: 'vendor/lite-model',
      LLM_MODEL_REGULAR: 'vendor/regular-model',
      LLM_MODEL_ADVANCED: 'vendor/advanced-model',
      LLM_MODEL_MAX: 'vendor/max-model',
    });
    const { getConfiguredModelId } = await import(
      '../../src/server/services/llmTutor/providers.js'
    );

    expect(getConfiguredModelId({ modelTier: 'lite' })).toBe('vendor/lite-model');
    expect(getConfiguredModelId({ modelTier: 'regular' })).toBe('vendor/regular-model');
    expect(getConfiguredModelId({ modelTier: 'advanced' })).toBe('vendor/advanced-model');
    expect(getConfiguredModelId({ modelTier: 'max' })).toBe('vendor/max-model');
    expect(getConfiguredModelId()).toBe('vendor/regular-model');
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
