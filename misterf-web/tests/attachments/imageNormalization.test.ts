import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { maxImageEdgePixels } from '../../src/server/attachments/limits.js';
import { normalizeImageAttachment } from '../../src/server/attachments/imageNormalization.js';
import { isAttachmentRejectedError } from '../../src/server/attachments/types.js';

async function makeImage(input: {
  contentType: string;
  height: number;
  width: number;
}): Promise<Buffer> {
  const canvas = sharp({
    create: {
      background: { b: 220, g: 180, r: 120 },
      channels: 3,
      height: input.height,
      width: input.width,
    },
  });

  if (input.contentType === 'image/png') {
    return canvas.png().toBuffer();
  }
  if (input.contentType === 'image/webp') {
    return canvas.webp().toBuffer();
  }
  return canvas.jpeg().toBuffer();
}

describe('normalizeImageAttachment', () => {
  it('leaves an already small image within the edge limit', async () => {
    const bytes = await makeImage({
      contentType: 'image/png',
      height: 300,
      width: 400,
    });

    const result = await normalizeImageAttachment(bytes, 'image/png');

    expect(result.widthPixels).toBe(400);
    expect(result.heightPixels).toBe(300);
    expect(result.warnings).toEqual([]);
    expect(result.contentType).toBe('image/png');
  });

  it('downscales an oversized image and reports it', async () => {
    const bytes = await makeImage({
      contentType: 'image/jpeg',
      height: 1500,
      width: 3000,
    });

    const result = await normalizeImageAttachment(bytes, 'image/jpeg');

    expect(result.widthPixels).toBe(maxImageEdgePixels);
    expect(result.heightPixels).toBe(maxImageEdgePixels / 2);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'image_downscaled',
    ]);
  });

  it('strips metadata from the re-encoded image', async () => {
    const withExif = await sharp({
      create: {
        background: { b: 10, g: 20, r: 30 },
        channels: 3,
        height: 200,
        width: 200,
      },
    })
      .withMetadata({ exif: { IFD0: { Copyright: 'teacher-device' } } })
      .jpeg()
      .toBuffer();

    const result = await normalizeImageAttachment(withExif, 'image/jpeg');
    const metadata = await sharp(result.bytes).metadata();

    expect(metadata.exif).toBeUndefined();
  });

  it('keeps each supported format in its own family', async () => {
    const png = await makeImage({
      contentType: 'image/png',
      height: 64,
      width: 64,
    });
    const webp = await makeImage({
      contentType: 'image/webp',
      height: 64,
      width: 64,
    });

    expect((await sharp((await normalizeImageAttachment(png, 'image/png')).bytes).metadata()).format).toBe('png');
    expect((await sharp((await normalizeImageAttachment(webp, 'image/webp')).bytes).metadata()).format).toBe('webp');
  });

  it('rejects bytes that cannot be decoded as an image', async () => {
    const notAnImage = Buffer.from(
      '\x89PNG\r\n\x1a\n and then nothing valid at all',
      'latin1',
    );

    await expect(
      normalizeImageAttachment(notAnImage, 'image/png'),
    ).rejects.toSatisfy(isAttachmentRejectedError);
  });
});
