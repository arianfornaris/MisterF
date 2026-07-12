import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../services/creditGate.js';
import { generateSceneMediaAudio, SceneMediaAudioContentPolicyError, SceneMediaAudioProviderError, } from './audioGeneration.js';
import { generateSceneMediaImage, SceneMediaImageContentPolicyError, SceneMediaImageProviderError, } from './imageGeneration.js';
import { generateSceneMediaMetadataPackage, generateSceneMediaScriptPackage, SceneMediaScriptContentPolicyError, SceneMediaScriptProviderError, } from '../services/sceneMediaScripts.js';
import { createSceneMediaStorageKey, getUserFileStorageProvider, } from '../storage/userFileStorage.js';
import { createSceneMediaGenerationSourceContext, } from './generationContext.js';
import { readSceneMediaImageAsset } from './imageAssets.js';
const publicImmutableCacheControl = 'public, max-age=31536000, immutable';
const contentPolicyMessage = 'No se pudo crear la media por tener contenido no aprobado por nuestra política de contenidos.';
export class SceneMediaCreationError extends Error {
    reason;
    constructor(message, reason = 'generation_failed') {
        super(message);
        this.name = 'SceneMediaCreationError';
        this.reason = reason;
    }
}
export async function generateReadySceneMedia(input) {
    const mediaId = input.mediaId ?? randomUUID();
    const storage = getUserFileStorageProvider();
    const uploadedKeys = [];
    try {
        const sourceContext = createSourceContext(input);
        const sourceImage = input.sourceItem
            ? await readSceneMediaImageAsset(input.sourceItem)
            : undefined;
        const shouldGenerateImage = !input.sourceItem ||
            input.layerDecisions?.image === 'generate_new';
        const imageResult = shouldGenerateImage
            ? await generateAndStoreImage({
                ...input,
                mediaId,
                referenceImage: sourceImage,
                sourceContext,
            })
            : await reuseImage(input.sourceItem, storage);
        if ('uploadedStorageKey' in imageResult &&
            typeof imageResult.uploadedStorageKey === 'string') {
            uploadedKeys.push(imageResult.uploadedStorageKey);
        }
        const shouldGenerateScript = input.generationMode === 'complete_scene' && (!input.sourceItem || input.layerDecisions?.scriptAndAudio === 'generate_new');
        const shouldKeepScript = Boolean(input.sourceItem &&
            input.layerDecisions?.scriptAndAudio === 'keep_existing' &&
            input.sourceItem.script &&
            input.sourceItem.audio);
        const metadata = await generateMetadata({
            ...input,
            imageAsset: imageResult.asset,
            includeScript: shouldGenerateScript,
            sourceContext,
        });
        const script = shouldGenerateScript
            ? metadata.script
            : shouldKeepScript
                ? input.sourceItem?.script
                : undefined;
        const audioResult = shouldGenerateScript && script
            ? await generateAndStoreAudio({
                mediaId,
                ownerUserId: input.ownerUserId,
                script,
            })
            : shouldKeepScript
                ? await reuseAudio(input.sourceItem, storage)
                : undefined;
        if (audioResult &&
            'uploadedStorageKey' in audioResult &&
            typeof audioResult.uploadedStorageKey === 'string') {
            uploadedKeys.push(audioResult.uploadedStorageKey);
        }
        const image = {
            ...imageResult.layer,
            alt: metadata.visualSummary.join(' '),
        };
        const generationMode = script && audioResult
            ? 'complete_scene'
            : 'image_only';
        const snapshot = createAuthoringSnapshot({
            audio: audioResult?.layer,
            format: input.format,
            image,
            level: input.level,
            script,
            setting: metadata.setting,
            skills: metadata.skills,
            tags: metadata.tags,
            title: metadata.title,
            useCases: metadata.useCases,
            visualSummary: metadata.visualSummary,
        });
        return {
            audio: audioResult?.layer,
            authoringMessages: createInitialAuthoringMessages(input.prompt, snapshot, input.createdAssistantMessage),
            createdFrom: input.sourceItem ? {
                baseBuiltInMediaId: input.sourceItem.source === 'built_in'
                    ? input.sourceItem.id
                    : undefined,
                baseVisualAssetId: input.sourceItem.visualAssetId,
                prompt: input.prompt,
                sourceMediaId: input.sourceItem.id,
            } : { prompt: input.prompt },
            format: input.format,
            generationMode,
            id: mediaId,
            image,
            level: input.level,
            ownerProfileId: input.ownerProfileId,
            ownerUserId: input.ownerUserId,
            prompt: input.prompt,
            provenance: {
                layerDecisions: input.layerDecisions ?? null,
                sourceMediaId: input.sourceItem?.id ?? null,
                sourceVisualAssetId: input.sourceItem?.visualAssetId ?? null,
            },
            script,
            scriptTypePreference: input.scriptTypePreference,
            setting: metadata.setting,
            skills: metadata.skills,
            sourceMediaId: input.sourceItem?.id ?? null,
            sourceVisualAssetId: input.sourceItem?.visualAssetId ?? null,
            tags: metadata.tags,
            title: metadata.title,
            useCases: metadata.useCases,
            visualSummary: metadata.visualSummary,
        };
    }
    catch (error) {
        await Promise.allSettled(uploadedKeys.map((key) => storage.deleteObject(key)));
        throw mapCreationError(error);
    }
}
export async function deleteUnpersistedSceneMediaObjects(draft, sourceItem) {
    const sourceKeys = new Set([
        sourceItem?.image?.storageKey,
        sourceItem?.audio?.storageKey,
    ].filter((value) => Boolean(value)));
    const draftKeys = [draft.image.storageKey, draft.audio?.storageKey]
        .filter((value) => Boolean(value))
        .filter((value) => !sourceKeys.has(value));
    const storage = getUserFileStorageProvider();
    await Promise.allSettled(draftKeys.map((key) => storage.deleteObject(key)));
}
async function generateAndStoreImage(input) {
    const openRouterApiKey = await requireCreditKey(input.ownerUserId);
    const generated = await generateSceneMediaImage({
        format: input.format,
        level: input.level,
        openRouterApiKey,
        prompt: input.prompt,
        referenceImages: input.referenceImage ? [input.referenceImage] : undefined,
        scriptTypePreference: input.scriptTypePreference,
        sourceContext: input.sourceContext,
    });
    const normalizedBytes = await sharp(generated.bytes)
        .resize(720, 720, { fit: 'cover', position: 'attention' })
        .webp({ quality: 84 })
        .toBuffer();
    const checksumSha256 = createHash('sha256').update(normalizedBytes).digest('hex');
    const storageKey = createSceneMediaStorageKey({
        extension: 'webp',
        fileRole: 'image',
        mediaId: input.mediaId,
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
            mediaId: input.mediaId,
            model: generated.model,
            provider: generated.provider,
            userId: input.ownerUserId,
        },
        visibility: 'public-read',
    });
    return {
        asset: { bytes: normalizedBytes, contentType: 'image/webp' },
        layer: {
            alt: '',
            checksumSha256,
            contentType: 'image/webp',
            height: 720,
            mediaId: input.mediaId,
            source: 'user_generated',
            src: storage.createPublicUrl(storageKey),
            storageKey,
            width: 720,
        },
        uploadedStorageKey: storageKey,
    };
}
async function reuseImage(sourceItem, storage) {
    if (!sourceItem?.image) {
        throw new SceneMediaCreationError('The source media does not have an image.', 'invalid_source');
    }
    if (sourceItem.image.storageKey) {
        await storage.makeObjectPublic(sourceItem.image.storageKey);
    }
    return {
        asset: await readSceneMediaImageAsset(sourceItem),
        layer: sourceItem.image.storageKey
            ? { ...sourceItem.image, src: storage.createPublicUrl(sourceItem.image.storageKey) }
            : sourceItem.image,
    };
}
async function generateMetadata(input) {
    const openRouterApiKey = await requireCreditKey(input.ownerUserId);
    const generationInput = {
        format: input.format,
        imageBytes: input.imageAsset.bytes,
        imageContentType: input.imageAsset.contentType,
        level: input.level,
        openRouterApiKey,
        prompt: input.prompt,
        scriptTypePreference: input.scriptTypePreference,
        sourceContext: input.sourceContext,
    };
    if (input.includeScript) {
        return generateSceneMediaScriptPackage(generationInput);
    }
    return generateSceneMediaMetadataPackage(generationInput);
}
async function generateAndStoreAudio(input) {
    const openRouterApiKey = await requireCreditKey(input.ownerUserId);
    const generated = await generateSceneMediaAudio({ openRouterApiKey, script: input.script });
    const storageKey = createSceneMediaStorageKey({
        extension: generated.extension,
        fileRole: 'audio',
        mediaId: input.mediaId,
        userId: input.ownerUserId,
    });
    const storage = getUserFileStorageProvider();
    await storage.putObject({
        body: generated.bytes,
        cacheControl: publicImmutableCacheControl,
        contentType: generated.contentType,
        key: storageKey,
        metadata: {
            mediaId: input.mediaId,
            model: generated.model,
            provider: generated.provider,
            userId: input.ownerUserId,
        },
        visibility: 'public-read',
    });
    return {
        layer: {
            durationSeconds: generated.durationSeconds,
            format: 'mp3',
            model: generated.model,
            provider: generated.provider,
            src: storage.createPublicUrl(storageKey),
            storageKey,
            voices: generated.voices,
        },
        uploadedStorageKey: storageKey,
    };
}
async function reuseAudio(sourceItem, storage) {
    if (!sourceItem?.audio) {
        return undefined;
    }
    if (sourceItem.audio.storageKey) {
        await storage.makeObjectPublic(sourceItem.audio.storageKey);
        return {
            layer: {
                ...sourceItem.audio,
                src: storage.createPublicUrl(sourceItem.audio.storageKey),
            },
        };
    }
    return { layer: sourceItem.audio };
}
function createSourceContext(input) {
    return input.sourceItem && input.layerDecisions
        ? createSceneMediaGenerationSourceContext({
            layerDecisions: input.layerDecisions,
            sourceItem: input.sourceItem,
        })
        : undefined;
}
async function requireCreditKey(userId) {
    const key = await getCreditCheckedOpenRouterApiKeyForUser(userId);
    if (!key) {
        throw new SceneMediaCreationError('Missing user OpenRouter API key.', 'provider_not_configured');
    }
    return key;
}
function mapCreationError(error) {
    if (error instanceof SceneMediaCreationError) {
        return error;
    }
    if (error instanceof SceneMediaImageContentPolicyError ||
        error instanceof SceneMediaScriptContentPolicyError ||
        error instanceof SceneMediaAudioContentPolicyError) {
        return new SceneMediaCreationError(contentPolicyMessage, 'content_policy');
    }
    if (error instanceof SceneMediaImageProviderError) {
        return new SceneMediaCreationError('Unable to generate this media image.', 'image_provider_error');
    }
    if (error instanceof SceneMediaScriptProviderError) {
        return new SceneMediaCreationError('Unable to generate this media metadata.', 'script_provider_error');
    }
    if (error instanceof SceneMediaAudioProviderError) {
        return new SceneMediaCreationError('Unable to generate this media audio.', 'audio_provider_error');
    }
    return error instanceof Error ? error : new Error(String(error));
}
function createInitialAuthoringMessages(prompt, snapshot, assistantMessage = 'The media was created successfully.') {
    const now = new Date().toISOString();
    return [
        { content: prompt, createdAt: now, role: 'user' },
        {
            content: assistantMessage,
            createdAt: now,
            draftSnapshot: snapshot,
            role: 'assistant',
        },
    ];
}
export function createAuthoringSnapshot(input) {
    return { ...input };
}
//# sourceMappingURL=creation.js.map