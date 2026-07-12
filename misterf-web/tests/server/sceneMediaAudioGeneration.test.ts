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
  it('wraps one PCM response per spoken turn in a WAV clip', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.APP_BASE_URL = 'https://misterf.test';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
    process.env.SCENE_MEDIA_TTS_MODEL = 'test/tts-model';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(Buffer.from([1, 2, 3, 4]), {
        headers: { 'content-type': 'application/octet-stream' },
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(Buffer.from([5, 6, 7, 8]), {
        headers: { 'content-type': 'application/octet-stream' },
        status: 200,
      }));
    const getOpenRouterApiKey = vi.fn().mockResolvedValue('user-openrouter-key');
    const { generateSceneMediaAudio } = await import(
      '../../src/server/sceneMedia/audioGeneration.js'
    );

    const result = await generateSceneMediaAudio({
      getOpenRouterApiKey,
      script: {
        identityStrategy: 'named_in_dialogue',
        scriptType: 'dialogue',
        speakers: [
          { name: 'Maya', nameSpokenInAudio: true, role: 'traveler' },
          { name: 'Leo', nameSpokenInAudio: true, role: 'clerk' },
        ],
        turns: [
          { speaker: 'Maya', text: 'Hello, Leo.' },
          { speaker: 'Leo', text: 'Hello, Maya.' },
        ],
      },
    });

    expect(result).toEqual(expect.objectContaining({
      model: 'test/tts-model',
      provider: 'openrouter',
      voiceStrategy: 'per_turn_clips',
    }));
    expect(result.clips).toHaveLength(2);
    expect(result.clips.map((clip) => ({
      contentType: clip.contentType,
      extension: clip.extension,
      speaker: clip.speaker,
      turn: clip.turn,
      voice: clip.voice,
    }))).toEqual([
      {
        contentType: 'audio/wav',
        extension: 'wav',
        speaker: 'Maya',
        turn: 1,
        voice: 'Kore',
      },
      {
        contentType: 'audio/wav',
        extension: 'wav',
        speaker: 'Leo',
        turn: 2,
        voice: 'Puck',
      },
    ]);
    expect(result.clips[0]?.bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(result.clips[0]?.bytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(result.clips[0]?.bytes.subarray(44)).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(getOpenRouterApiKey).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://openrouter.test/api/v1/audio/speech');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      input: 'Hello, Leo.',
      model: 'test/tts-model',
      response_format: 'pcm',
      voice: 'Kore',
    });
  });

  it('maps TTS safety rejections to a content-policy error', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        { error: { message: 'Prompt rejected by content policy.' } },
        { status: 400 },
      ),
    );
    const {
      generateSceneMediaAudio,
      SceneMediaAudioContentPolicyError,
    } = await import('../../src/server/sceneMedia/audioGeneration.js');

    await expect(generateSceneMediaAudio({
      getOpenRouterApiKey: async () => 'user-openrouter-key',
      script: {
        identityStrategy: 'role_only',
        scriptType: 'narration',
        text: 'Rejected narration.',
      },
    })).rejects.toBeInstanceOf(SceneMediaAudioContentPolicyError);
  });

  it('retries transient TTS provider failures', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json(
        { error: { message: 'Provider rate limit reached.' } },
        { headers: { 'retry-after': '0' }, status: 429 },
      ))
      .mockResolvedValueOnce(new Response(Buffer.from([9, 10]), {
        headers: { 'content-type': 'application/octet-stream' },
        status: 200,
      }));
    const { generateSceneMediaAudio } = await import(
      '../../src/server/sceneMedia/audioGeneration.js'
    );

    const result = await generateSceneMediaAudio({
      getOpenRouterApiKey: async () => 'user-openrouter-key',
      script: {
        identityStrategy: 'role_only',
        scriptType: 'monologue',
        text: 'Please try this sentence again.',
      },
    });

    expect(result.clips[0]?.bytes.subarray(44)).toEqual(Buffer.from([9, 10]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
