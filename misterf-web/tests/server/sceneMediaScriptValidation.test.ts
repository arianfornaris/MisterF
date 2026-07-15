import { afterEach, describe, expect, it, vi } from 'vitest';

const aiMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: aiMocks.generateText,
}));

vi.mock('../../src/server/services/logger.js', () => loggerMocks);

const originalEnv = { ENV_FILE: process.env.ENV_FILE };

const metadata = {
  setting: 'Airport security area',
  title: 'Airport security line',
  visualSummary: ['A traveler waits at the security checkpoint.'],
};

const validScript = {
  identityStrategy: 'named_in_dialogue',
  scriptType: 'dialogue',
  speakers: [
    { gender: 'female', name: 'Ana', nameSpokenInAudio: true, role: 'traveler' },
    { gender: 'male', name: 'Officer', nameSpokenInAudio: false, role: 'security officer' },
  ],
  turns: [
    { speaker: 'Ana', text: 'Good morning, I am Ana. Here is my passport.' },
    { speaker: 'Officer', text: 'Thank you. Please place your bag on the belt.' },
  ],
};

// Same script but missing the required `speakers` field: exactly one schema issue.
const invalidScript = {
  identityStrategy: 'named_in_dialogue',
  scriptType: 'dialogue',
  turns: validScript.turns,
};

const input = {
  format: 'single_panel_scene' as const,
  level: 'A1-A2' as const,
  openRouterApiKey: 'test-openrouter-key',
  prompt: 'An A1 airport security listening scene.',
  scriptTypePreference: 'unspecified' as const,
};

afterEach(() => {
  if (originalEnv.ENV_FILE === undefined) {
    delete process.env.ENV_FILE;
  } else {
    process.env.ENV_FILE = originalEnv.ENV_FILE;
  }
  vi.clearAllMocks();
  vi.resetModules();
});

describe('scene media script validation logging', () => {
  it('logs the specific validation issues and feeds them into the retry', async () => {
    process.env.ENV_FILE = '/dev/null';
    aiMocks.generateText.mockResolvedValue({
      finishReason: 'stop',
      text: JSON.stringify({ ...metadata, script: invalidScript }),
    });
    const { generateSceneMediaScriptPackage } = await import(
      '../../src/server/services/sceneMediaScripts.js'
    );

    await expect(generateSceneMediaScriptPackage(input)).rejects.toMatchObject({
      name: 'SceneMediaScriptProviderError',
    });

    const warnCall = loggerMocks.logger.warn.mock.calls.find(
      ([event]) => event === 'scene_media_script_validation_failed',
    );
    expect(warnCall).toBeTruthy();
    const issues = warnCall?.[1]?.issues as Array<{ path: string }>;
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.some((issue) => issue.path.includes('speakers'))).toBe(true);

    // The retry prompt (second call) must carry the concrete issues back to the model.
    const retryMessages = aiMocks.generateText.mock.calls[1]?.[0]?.messages ?? [];
    const retryText = JSON.stringify(retryMessages);
    expect(retryText).toContain('validation issues');
    expect(retryText).toContain('speakers');
  });

  it('recovers when the retried response fixes the issues', async () => {
    process.env.ENV_FILE = '/dev/null';
    aiMocks.generateText
      .mockResolvedValueOnce({
        finishReason: 'stop',
        text: JSON.stringify({ ...metadata, script: invalidScript }),
      })
      .mockResolvedValueOnce({
        finishReason: 'stop',
        text: JSON.stringify({ ...metadata, script: validScript }),
      });
    const { generateSceneMediaScriptPackage } = await import(
      '../../src/server/services/sceneMediaScripts.js'
    );

    const result = await generateSceneMediaScriptPackage(input);
    expect(result.script).toMatchObject({ scriptType: 'dialogue' });
    expect(result.title).toBe(metadata.title);
    expect(aiMocks.generateText).toHaveBeenCalledTimes(2);
  });

  it('rejects turn speaker labels that do not match a declared speaker', async () => {
    process.env.ENV_FILE = '/dev/null';
    aiMocks.generateText.mockResolvedValue({
      finishReason: 'stop',
      text: JSON.stringify({
        ...metadata,
        script: {
          ...validScript,
          turns: [
            validScript.turns[0],
            { speaker: 'Security agent', text: 'Please place your bag on the belt.' },
          ],
        },
      }),
    });
    const { generateSceneMediaScriptPackage } = await import(
      '../../src/server/services/sceneMediaScripts.js'
    );

    await expect(generateSceneMediaScriptPackage(input)).rejects.toMatchObject({
      name: 'SceneMediaScriptProviderError',
    });
    const retryMessages = aiMocks.generateText.mock.calls[1]?.[0]?.messages ?? [];
    expect(JSON.stringify(retryMessages)).toContain('unknown_speaker');
    expect(JSON.stringify(retryMessages)).toContain('script.turns.1.speaker');
  });
});
