import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  APP_BASE_URL: process.env.APP_BASE_URL,
  ENV_FILE: process.env.ENV_FILE,
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
  SCENE_MEDIA_TTS_MODEL: process.env.SCENE_MEDIA_TTS_MODEL,
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('scene media audio generation', () => {
  it('requests MP3 speech from OpenRouter TTS', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.APP_BASE_URL = 'https://misterf.test';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
    process.env.SCENE_MEDIA_TTS_MODEL = 'test/tts-model';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('mp3-bytes'), {
        headers: {
          'content-type': 'audio/mpeg',
        },
        status: 200,
      }),
    );
    const { generateSceneMediaAudio } = await import(
      '../../src/server/sceneMedia/audioGeneration.js'
    );

    const result = await generateSceneMediaAudio({
      openRouterApiKey: 'user-openrouter-key',
      script: {
        scriptType: 'monologue',
        text: 'I need one train ticket, please.',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      bytes: Buffer.from('mp3-bytes'),
      contentType: 'audio/mpeg',
      extension: 'mp3',
      model: 'test/tts-model',
      provider: 'openrouter',
      voices: [
        {
          speaker: 'Speaker',
          voice: 'Kore',
        },
      ],
    }));
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://openrouter.test/api/v1/audio/speech');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer user-openrouter-key');
    expect(headers['HTTP-Referer']).toBe('https://misterf.test');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      input: 'I need one train ticket, please.',
      model: 'test/tts-model',
      response_format: 'mp3',
      voice: 'Kore',
    });
  });

  it('maps TTS safety rejections to a content-policy error', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        {
          error: {
            message: 'Prompt rejected by content policy.',
          },
        },
        { status: 400 },
      ),
    );
    const {
      generateSceneMediaAudio,
      SceneMediaAudioContentPolicyError,
    } = await import('../../src/server/sceneMedia/audioGeneration.js');

    await expect(generateSceneMediaAudio({
      openRouterApiKey: 'user-openrouter-key',
      script: {
        scriptType: 'narration',
        text: 'Rejected narration.',
      },
    })).rejects.toBeInstanceOf(SceneMediaAudioContentPolicyError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
