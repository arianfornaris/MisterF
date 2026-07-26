import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnvFile = process.env.ENV_FILE;
const originalModelLite = process.env.LLM_MODEL_LITE;
const originalModelRegular = process.env.LLM_MODEL_REGULAR;
const originalModelAdvanced = process.env.LLM_MODEL_ADVANCED;

afterEach(() => {
  restoreEnv('ENV_FILE', originalEnvFile);
  restoreEnv('LLM_MODEL_LITE', originalModelLite);
  restoreEnv('LLM_MODEL_REGULAR', originalModelRegular);
  restoreEnv('LLM_MODEL_ADVANCED', originalModelAdvanced);
  vi.resetModules();
});

describe('superadmin model configuration section', () => {
  it('provides the effective model id for each of the three levels', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.LLM_MODEL_LITE = 'google/test-flash-lite';
    process.env.LLM_MODEL_REGULAR = 'google/test-flash';
    process.env.LLM_MODEL_ADVANCED = 'google/test-pro-preview';
    vi.resetModules();

    const { getSuperadminModelLevels } = await import(
      '../../src/server/superadmin/models.js'
    );

    expect(getSuperadminModelLevels()).toEqual([
      {
        family: 'Flash-Lite',
        id: 'google/test-flash-lite',
        level: 'Lite',
        lifecycle: 'stable',
      },
      {
        family: 'Flash',
        id: 'google/test-flash',
        level: 'Regular',
        lifecycle: 'stable',
      },
      {
        family: 'Pro',
        id: 'google/test-pro-preview',
        level: 'Advanced',
        lifecycle: 'preview',
      },
    ]);
  });

  it('places the model information before users without a preview warning', () => {
    const view = fs.readFileSync(
      path.join(process.cwd(), 'views/superadmin.ejs'),
      'utf8',
    );

    expect(view.indexOf("t('superadmin.modelsTitle')")).toBeLessThan(
      view.indexOf("t('superadmin.allUsers')"),
    );
    expect(view).not.toContain('modelPreviewNotice');
    expect(view).not.toContain('/superadmin/models');
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
