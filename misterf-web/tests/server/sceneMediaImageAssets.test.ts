import { describe, expect, it } from 'vitest';
import { readSceneMediaImageAsset } from '../../src/server/sceneMedia/imageAssets.js';
import type { SceneMediaLibraryItem } from '../../src/server/sceneMedia/types.js';

function createMediaWithImage(src: string): SceneMediaLibraryItem {
  return {
    format: 'single_panel_scene',
    id: 'test-media',
    image: {
      alt: 'An airport security scene.',
      src,
    },
    level: 'A1-A2',
    source: 'built_in',
    status: 'ready',
    title: 'Test media',
    visualSummary: [],
  };
}

describe('scene media image assets', () => {
  it('maps the public URL prefix to the project public directory', async () => {
    const asset = await readSceneMediaImageAsset(createMediaWithImage(
      '/public/scene-media/images/airport-security-line-01.png',
    ));

    expect(asset.contentType).toBe('image/png');
    expect(asset.bytes.subarray(0, 8)).toEqual(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]));
  });

  it('rejects traversal outside the public directory', async () => {
    await expect(readSceneMediaImageAsset(createMediaWithImage(
      '/public/../package.json',
    ))).rejects.toThrow('Invalid built-in scene media image path.');
  });
});
