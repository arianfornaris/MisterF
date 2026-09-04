/**
 * Image normalization for attachments.
 *
 * Three jobs, all of which have to happen before an image reaches a model:
 *
 * - **Decode as validation.** A signature check says the header looks right;
 *   only a real decode proves the file is an image. Anything sharp cannot read
 *   is rejected here rather than failing later inside the provider.
 * - **Strip metadata.** Teacher photos carry EXIF, and EXIF carries GPS and
 *   device identifiers. sharp drops metadata unless asked to keep it, and
 *   `rotate()` bakes in the orientation flag before it goes.
 * - **Bound the cost.** Gemini tiles anything over 384px into 768x768 tiles at
 *   258 tokens each, so an untouched 12-megapixel photo is billed as dozens of
 *   tiles for no legibility gain.
 */

import sharp, { type Sharp } from 'sharp';

import { maxImageEdgePixels } from './limits.js';
import {
  AttachmentRejectedError,
  type AttachmentWarning,
} from './types.js';

export type NormalizedImage = {
  bytes: Buffer;
  contentType: string;
  heightPixels: number;
  warnings: AttachmentWarning[];
  widthPixels: number;
};

/**
 * Re-encodes an image at a bounded size with metadata removed. The output keeps
 * the input's format family: PNG stays lossless because screenshots and
 * diagrams of text suffer visibly from JPEG artifacts, while photographic
 * formats re-encode lossily where that is already the right tradeoff.
 */
export async function normalizeImageAttachment(
  bytes: Buffer,
  contentType: string,
): Promise<NormalizedImage> {
  const warnings: AttachmentWarning[] = [];

  // `failOn: 'error'` keeps sharp from silently accepting a truncated or
  // malformed file that would then reach the provider as garbage.
  const pipeline = sharp(bytes, { failOn: 'error' });

  const metadata = await pipeline.metadata().catch(() => null);
  if (!metadata?.width || !metadata.height) {
    throw new AttachmentRejectedError('decode_failed');
  }

  const longestEdge = Math.max(metadata.width, metadata.height);
  const needsDownscale = longestEdge > maxImageEdgePixels;
  if (needsDownscale) {
    warnings.push({
      code: 'image_downscaled',
      values: { maxEdge: maxImageEdgePixels },
    });
  }

  // `rotate()` with no argument applies the EXIF orientation before the tag is
  // dropped, so a portrait photo does not reach the model on its side.
  const resized = pipeline.rotate().resize({
    fit: 'inside',
    height: maxImageEdgePixels,
    width: maxImageEdgePixels,
    withoutEnlargement: true,
  });

  const encoded = await encodeForContentType(resized, contentType)
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!encoded) {
    throw new AttachmentRejectedError('decode_failed');
  }

  return {
    bytes: encoded.data,
    contentType,
    heightPixels: encoded.info.height,
    warnings,
    widthPixels: encoded.info.width,
  };
}

function encodeForContentType(pipeline: Sharp, contentType: string): Sharp {
  if (contentType === 'image/png') {
    return pipeline.png({ compressionLevel: 9 });
  }

  if (contentType === 'image/webp') {
    return pipeline.webp({ quality: 82 });
  }

  return pipeline.jpeg({ mozjpeg: true, quality: 82 });
}
