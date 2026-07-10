import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { getUserFileStorageProvider } from '../storage/userFileStorage.js';
import type { SceneMediaLibraryItem } from './types.js';

export type SceneMediaImageAsset = {
  bytes: Buffer;
  contentType: string;
};

export async function readSceneMediaImageAsset(
  media: SceneMediaLibraryItem,
): Promise<SceneMediaImageAsset> {
  const image = media.image;
  if (!image) {
    throw new Error('Scene media does not have an image layer.');
  }

  if (image.storageKey) {
    const url = await getUserFileStorageProvider().createReadUrl({
      expiresInSeconds: 300,
      storageKey: image.storageKey,
    });
    return downloadImage(url, image.contentType);
  }

  if (image.src.startsWith('/public/')) {
    const relativePath = image.src.slice('/public/'.length);
    const publicRoot = path.resolve(env.projectRoot, 'public');
    const absolutePath = path.resolve(publicRoot, relativePath);
    if (!absolutePath.startsWith(`${publicRoot}${path.sep}`)) {
      throw new Error('Invalid built-in scene media image path.');
    }
    return {
      bytes: await fs.readFile(absolutePath),
      contentType: image.contentType ?? contentTypeFromPath(absolutePath),
    };
  }

  if (image.src.startsWith('/')) {
    return downloadImage(new URL(image.src, env.appBaseUrl).toString(), image.contentType);
  }

  return downloadImage(image.src, image.contentType);
}

async function downloadImage(
  url: string,
  fallbackContentType?: string,
): Promise<SceneMediaImageAsset> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to read scene media image (HTTP ${response.status}).`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type')?.split(';')[0]?.trim() ||
      fallbackContentType ||
      contentTypeFromPath(new URL(url).pathname),
  };
}

function contentTypeFromPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}
