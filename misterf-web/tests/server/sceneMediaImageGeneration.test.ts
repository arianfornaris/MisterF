import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  APP_BASE_URL: process.env.APP_BASE_URL,
  ENV_FILE: process.env.ENV_FILE,
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
  SCENE_MEDIA_IMAGE_MODEL: process.env.SCENE_MEDIA_IMAGE_MODEL,
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

describe('scene media image generation', () => {
  it('requests a generated image from the OpenRouter Images API', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.APP_BASE_URL = 'https://misterf.test';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
    process.env.SCENE_MEDIA_IMAGE_MODEL = 'test/image-model';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        data: [
          {
            b64_json: Buffer.from('generated-image').toString('base64'),
            media_type: 'image/png',
          },
        ],
        usage: {
          completion_tokens: 20,
          cost: 0.04,
          prompt_tokens: 10,
          total_tokens: 30,
        },
      }),
    );
    const { generateSceneMediaImage } = await import(
      '../../src/server/sceneMedia/imageGeneration.js'
    );

    const result = await generateSceneMediaImage({
      format: 'four_panel_wordless_story',
      level: 'B1-B2',
      openRouterApiKey: 'user-openrouter-key',
      prompt: 'A student checks in at an airport.',
      scriptTypePreference: 'dialogue',
      sourceContext: {
        format: 'single_panel_scene',
        imageAlt: 'A student stands at an airport check-in counter.',
        layerDecisions: {
          image: 'generate_new',
          scriptAndAudio: 'keep_existing',
        },
        level: 'A1-A2',
        script: {
          identityStrategy: 'named_in_dialogue',
          scriptType: 'dialogue',
          speakers: [
            { name: 'Agent', nameSpokenInAudio: true, role: 'airline_agent' },
            { name: 'Student', nameSpokenInAudio: true, role: 'traveler' },
          ],
          turns: [
            { speaker: 'Agent', text: 'May I see your passport?' },
            { speaker: 'Student', text: 'Yes, here it is.' },
          ],
        },
        setting: 'Airport check-in counter',
        title: 'Checking In',
        visualSummary: ['A student gives a passport to an airline agent.'],
      },
    });

    expect(result).toMatchObject({
      contentType: 'image/png',
      extension: 'png',
      model: 'test/image-model',
      provider: 'openrouter',
      usage: {
        completionTokens: 20,
        costUsd: 0.04,
        promptTokens: 10,
        totalTokens: 30,
      },
    });
    expect(result.bytes.toString()).toBe('generated-image');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://openrouter.test/api/v1/images');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer user-openrouter-key');
    expect(headers['HTTP-Referer']).toBe('https://misterf.test');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      aspect_ratio: '1:1',
      model: 'test/image-model',
      n: 1,
      output_format: 'png',
      quality: 'medium',
      resolution: '1K',
    });
    expect(String(body.prompt)).toContain('A student checks in at an airport.');
    expect(String(body.prompt)).toContain('"title": "Checking In"');
    expect(String(body.prompt)).toContain('"setting": "Airport check-in counter"');
    expect(String(body.prompt)).toContain('"scriptAndAudio": "keep_existing"');
    expect(String(body.prompt)).toContain('"text": "May I see your passport?"');
    expect(String(body.prompt)).toContain('immutable compatibility anchors');
    expect(String(body.prompt)).toContain('no captions, subtitles, labels, panel numbers');
    expect(String(body.prompt)).toContain('Real-world text or signage is allowed only when it is intrinsic to the requested setting');
  });

  it('maps provider safety rejections to a content-policy error', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'moderation_blocked',
            message: 'Prompt rejected by content policy.',
          },
        },
        { status: 400 },
      ),
    );
    const {
      generateSceneMediaImage,
      SceneMediaImageContentPolicyError,
    } = await import('../../src/server/sceneMedia/imageGeneration.js');

    await expect(generateSceneMediaImage({
      format: 'single_panel_scene',
      level: 'A1-A2',
      openRouterApiKey: 'user-openrouter-key',
      prompt: 'Rejected prompt',
      scriptTypePreference: 'unspecified',
    })).rejects.toBeInstanceOf(SceneMediaImageContentPolicyError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
