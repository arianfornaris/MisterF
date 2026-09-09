import path from 'node:path';
import { env } from '../config/env.js';
import { getUserFileStorageProvider } from '../storage/userFileStorage.js';
export async function readSceneMediaImageAsset(media) {
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
    if (image.src.startsWith('/')) {
        return downloadImage(new URL(image.src, env.appBaseUrl).toString(), image.contentType);
    }
    return downloadImage(image.src, image.contentType);
}
async function downloadImage(url, fallbackContentType) {
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
function contentTypeFromPath(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.jpg' || extension === '.jpeg') {
        return 'image/jpeg';
    }
    if (extension === '.webp') {
        return 'image/webp';
    }
    return 'image/png';
}
//# sourceMappingURL=imageAssets.js.map