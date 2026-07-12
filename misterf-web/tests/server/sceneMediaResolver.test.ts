import { afterEach, describe, expect, it, vi } from 'vitest';

const aiMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: aiMocks.generateText,
}));

const originalEnv = {
  ENV_FILE: process.env.ENV_FILE,
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

describe('scene media resolver', () => {
  it('returns a validated recommendation for a real catalog id', async () => {
    process.env.ENV_FILE = '/dev/null';
    aiMocks.generateText.mockResolvedValue({
      text: JSON.stringify({
        confidence: 'high',
        layers: {
          audio: true,
          image: true,
          script: true,
        },
        mediaId: 'airport-security-line-01-a1-a2',
        reason: 'The airport security scene matches travel instructions.',
        strategy: 'existing_media',
      }),
    });
    const { resolveSceneMedia } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const recommendation = await resolveSceneMedia({
      criteria: 'A short A1 airport security listening scene.',
      desiredLayers: ['image', 'audio', 'script'],
      learnerLevel: 'A1-A2',
      openRouterApiKey: 'test-openrouter-key',
    });

    expect(recommendation).toEqual({
      alternates: [],
      confidence: 'high',
      layers: {
        audio: true,
        image: true,
        script: true,
      },
      mediaId: 'airport-security-line-01-a1-a2',
      reason: 'The airport security scene matches travel instructions.',
      strategy: 'existing_media',
    });
    expect(aiMocks.generateText).toHaveBeenCalledOnce();
    const call = aiMocks.generateText.mock.calls[0]?.[0];
    expect(call?.messages?.[0]?.content).toContain('Compact catalog:');
    expect(call?.messages?.[0]?.content).not.toContain('/public/scene-media/');
    expect(call?.messages?.[0]?.content).not.toContain('Put your bag in the box');
  });

  it('uses a valid alternate when the primary media id is invalid', async () => {
    process.env.ENV_FILE = '/dev/null';
    aiMocks.generateText.mockResolvedValue({
      text: JSON.stringify({
        alternates: ['airport-security-line-01-b1-b2'],
        confidence: 'medium',
        mediaId: 'invented-media-id',
        reason: 'The alternate is a valid airport item.',
        strategy: 'existing_media',
      }),
    });
    const { resolveSceneMedia } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const recommendation = await resolveSceneMedia({
      criteria: 'Airport security practice.',
      desiredLayers: ['image'],
      openRouterApiKey: 'test-openrouter-key',
    });

    expect(recommendation).toEqual(expect.objectContaining({
      confidence: 'medium',
      mediaId: 'airport-security-line-01-b1-b2',
      strategy: 'existing_media',
    }));
  });

  it('falls back deterministically when the model returns malformed JSON', async () => {
    process.env.ENV_FILE = '/dev/null';
    aiMocks.generateText.mockResolvedValue({
      text: 'not json',
    });
    const { resolveSceneMedia } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const recommendation = await resolveSceneMedia({
      criteria: 'A restaurant problem.',
      desiredLayers: ['image'],
      openRouterApiKey: 'test-openrouter-key',
      recentMediaIds: ['airport-security-line-01-a1-a2'],
    });

    expect(recommendation.strategy).toBe('existing_media');
    expect(recommendation.confidence).toBe('low');
    expect(recommendation.mediaId).not.toBe('airport-security-line-01-a1-a2');
  });

  it('builds a compact catalog without user media when ownership is omitted', async () => {
    process.env.ENV_FILE = '/dev/null';
    const { buildCompactSceneMediaCatalog } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const catalog = buildCompactSceneMediaCatalog({
      includeUserGenerated: true,
      learnerLevel: 'A1-A2',
    });

    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.every((item) => item.source === 'built_in')).toBe(true);
  });
});
