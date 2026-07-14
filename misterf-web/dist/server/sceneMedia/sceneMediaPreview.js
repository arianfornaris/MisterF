import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../services/creditGate.js';
import { generateSceneMediaScriptPackage, SceneMediaScriptContentPolicyError, SceneMediaScriptProviderError, } from '../services/sceneMediaScripts.js';
import { createSceneMediaStorageKey, getUserFileStorageProvider, } from '../storage/userFileStorage.js';
import { generateSceneMediaAudio, SceneMediaAudioContentPolicyError, SceneMediaAudioProviderError, } from './audioGeneration.js';
import { SceneMediaCreationError, } from './creation.js';
import { generateSceneMediaImage, SceneMediaImageContentPolicyError, SceneMediaImageProviderError, } from './imageGeneration.js';
import { readSceneMediaImageAsset } from './imageAssets.js';
const publicImmutableCacheControl = 'public, max-age=31536000, immutable';
const contentPolicyMessage = 'No se pudo crear la media por tener contenido no aprobado por nuestra política de contenidos.';
// Reads the image the next generation should refine: the pending preview image
// when one exists (so edits chain iteratively), otherwise the live image.
export async function readSceneMediaReferenceImage(media, previewImage) {
    const image = previewImage ?? media.image;
    if (!image) {
        return undefined;
    }
    try {
        return await readSceneMediaImageAsset({ ...media, image });
    }
    catch {
        return undefined;
    }
}
export async function generateSceneMediaImagePreview(input) {
    const report = input.onProgress ?? (() => { });
    report({ stage: 'image', completed: 0, total: 1 });
    try {
        const openRouterApiKey = await requireCreditKey(input.ownerUserId);
        const generated = await generateSceneMediaImage({
            format: input.media.format,
            level: input.media.level ?? 'A1-A2',
            openRouterApiKey,
            prompt: input.prompt,
            referenceImages: input.referenceImage ? [input.referenceImage] : undefined,
            scriptTypePreference: input.media.scriptTypePreference ?? 'unspecified',
        });
        const normalizedBytes = await sharp(generated.bytes)
            .resize(720, 720, { fit: 'cover', position: 'attention' })
            .webp({ quality: 84 })
            .toBuffer();
        const checksumSha256 = createHash('sha256').update(normalizedBytes).digest('hex');
        const storageKey = createSceneMediaStorageKey({
            extension: 'webp',
            fileId: `preview-${input.previewId}`,
            fileRole: 'image',
            mediaId: input.media.id,
            userId: input.ownerUserId,
        });
        const storage = getUserFileStorageProvider();
        await storage.putObject({
            body: normalizedBytes,
            cacheControl: publicImmutableCacheControl,
            contentType: 'image/webp',
            key: storageKey,
            metadata: {
                checksumSha256,
                mediaId: input.media.id,
                model: generated.model,
                provider: generated.provider,
                userId: input.ownerUserId,
            },
            visibility: 'public-read',
        });
        report({ stage: 'image', completed: 1, total: 1 });
        return {
            image: {
                alt: input.media.image?.alt ?? '',
                checksumSha256,
                contentType: 'image/webp',
                height: 720,
                mediaId: input.media.id,
                source: 'user_generated',
                src: storage.createPublicUrl(storageKey),
                storageKey,
                width: 720,
            },
            storageKeys: [storageKey],
        };
    }
    catch (error) {
        throw mapPreviewError(error);
    }
}
export async function generateSceneMediaScriptPreview(input) {
    const report = input.onProgress ?? (() => { });
    const storage = getUserFileStorageProvider();
    const uploadedStorageKeys = [];
    try {
        report({ stage: 'metadata', completed: 0, total: 1 });
        const openRouterApiKey = await requireCreditKey(input.ownerUserId);
        const imageAsset = input.media.image
            ? await readSceneMediaImageAsset(input.media)
            : undefined;
        const scriptPackage = await generateSceneMediaScriptPackage({
            format: input.media.format,
            imageAlt: input.media.image?.alt,
            imageBytes: imageAsset?.bytes,
            imageContentType: imageAsset?.contentType,
            level: input.media.level ?? 'A1-A2',
            openRouterApiKey,
            prompt: input.prompt,
            scriptTypePreference: input.media.scriptTypePreference ?? 'unspecified',
        });
        const script = scriptPackage.script;
        report({ stage: 'metadata', completed: 1, total: 1 });
        const generated = await generateSceneMediaAudio({
            getOpenRouterApiKey: () => requireCreditKey(input.ownerUserId),
            onClipProgress: (completed, total) => report({ stage: 'audio', completed, total }),
            script,
        });
        const clips = [];
        for (const clip of generated.clips) {
            const storageKey = createSceneMediaStorageKey({
                extension: clip.extension,
                fileId: `preview-${input.previewId}-turn-${String(clip.turn).padStart(2, '0')}`,
                fileRole: 'audio',
                mediaId: input.media.id,
                userId: input.ownerUserId,
            });
            await storage.putObject({
                body: clip.bytes,
                cacheControl: publicImmutableCacheControl,
                contentType: clip.contentType,
                key: storageKey,
                metadata: {
                    mediaId: input.media.id,
                    model: generated.model,
                    provider: generated.provider,
                    speaker: clip.speaker,
                    turn: String(clip.turn),
                    userId: input.ownerUserId,
                    voice: clip.voice,
                },
                visibility: 'public-read',
            });
            uploadedStorageKeys.push(storageKey);
            clips.push({
                speaker: clip.speaker,
                src: storage.createPublicUrl(storageKey),
                storageKey,
                turn: clip.turn,
            });
        }
        return {
            audio: {
                clips,
                format: 'wav',
                model: generated.model,
                provider: generated.provider,
                voiceStrategy: generated.voiceStrategy,
            },
            script,
            storageKeys: uploadedStorageKeys,
        };
    }
    catch (error) {
        await Promise.allSettled(uploadedStorageKeys.map((key) => storage.deleteObject(key)));
        throw mapPreviewError(error);
    }
}
async function requireCreditKey(userId) {
    const key = await getCreditCheckedOpenRouterApiKeyForUser(userId);
    if (!key) {
        throw new SceneMediaCreationError('Missing user OpenRouter API key.', 'provider_not_configured');
    }
    return key;
}
function mapPreviewError(error) {
    if (error instanceof SceneMediaCreationError) {
        return error;
    }
    if (error instanceof SceneMediaImageContentPolicyError ||
        error instanceof SceneMediaScriptContentPolicyError ||
        error instanceof SceneMediaAudioContentPolicyError) {
        return new SceneMediaCreationError(contentPolicyMessage, 'content_policy');
    }
    if (error instanceof SceneMediaImageProviderError) {
        return new SceneMediaCreationError('Unable to generate this media image.', 'image_provider_error', { cause: error });
    }
    if (error instanceof SceneMediaScriptProviderError) {
        return new SceneMediaCreationError('Unable to generate this media script.', 'script_provider_error', { cause: error });
    }
    if (error instanceof SceneMediaAudioProviderError) {
        return new SceneMediaCreationError('Unable to generate this media audio.', 'audio_provider_error', { cause: error });
    }
    return error instanceof Error ? error : new Error(String(error));
}
//# sourceMappingURL=sceneMediaPreview.js.map