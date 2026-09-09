import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSceneMediaImageAsset } from '../../src/server/sceneMedia/imageAssets.js';
import type { SceneMediaLibraryItem } from '../../src/server/sceneMedia/types.js';

const originalFetch = globalThis.fetch;
const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createMediaWithImage(src: string): SceneMediaLibraryItem {
  return {
    format: 'single_panel_scene',
    id: 'test-media',
    image: {
      alt: 'An airport security scene.',
      src,
    },
    level: 'A1-A2',
    status: 'ready',
    title: 'Test media',
    visualSummary: [],
  };
}

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(pngBytes, {
    headers: { 'content-type': 'image/png' },
    status: 200,
  }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('scene media image assets', () => {
  it('downloads an absolute image url as it is', async () => {
    const fetchMock = stubFetch();

    const asset = await readSceneMediaImageAsset(createMediaWithImage(
      'https://cdn.example.test/scene-media/image.png',
    ));

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.test/scene-media/image.png');
    expect(asset.contentType).toBe('image/png');
    expect(asset.bytes.subarray(0, 8)).toEqual(Buffer.from(pngBytes));
  });

  it('resolves a root-relative image src against the app base url', async () => {
    const fetchMock = stubFetch();
    const { env } = await import('../../src/server/config/env.js');

    await readSceneMediaImageAsset(createMediaWithImage('/media-library/test-media/image'));

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/media-library/test-media/image', env.appBaseUrl).toString(),
    );
  });

  it('rejects media without an image layer', async () => {
    await expect(readSceneMediaImageAsset({
      format: 'single_panel_scene',
      id: 'no-image',
      level: 'A1-A2',
      status: 'ready',
      title: 'No image',
      visualSummary: [],
    })).rejects.toThrow('Scene media does not have an image layer.');
  });
});
