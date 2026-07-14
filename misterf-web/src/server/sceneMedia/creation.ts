import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../services/creditGate.js';
import {
  generateSceneMediaAudio,
  SceneMediaAudioContentPolicyError,
  SceneMediaAudioProviderError,
} from './audioGeneration.js';
import {
  generateSceneMediaImage,
  SceneMediaImageContentPolicyError,
  SceneMediaImageProviderError,
} from './imageGeneration.js';
import {
  generateSceneMediaMetadataPackage,
  generateSceneMediaScriptPackage,
  SceneMediaScriptContentPolicyError,
  SceneMediaScriptProviderError,
  type GeneratedSceneMediaMetadataPackage,
} from '../services/sceneMediaScripts.js';
import {
  createSceneMediaStorageKey,
  getUserFileStorageProvider,
} from '../storage/userFileStorage.js';
import {
  createSceneMediaGenerationSourceContext,
  type SceneMediaGenerationSourceContext,
} from './generationContext.js';
import { readSceneMediaImageAsset, type SceneMediaImageAsset } from './imageAssets.js';
import type {
  SceneMediaAudioLayer,
  SceneMediaAuthoringMessage,
  SceneMediaFormat,
  SceneMediaImageLayer,
  SceneMediaLevel,
  SceneMediaLibraryItem,
  SceneMediaScript,
  UserSceneMediaGenerationMode,
  UserSceneMediaLayerDecisions,
  UserSceneMediaScriptTypePreference,
} from './types.js';
import type { CreateReadyUserSceneMediaInput } from './userMediaRepository.js';

const publicImmutableCacheControl = 'public, max-age=31536000, immutable';
const contentPolicyMessage =
  'No se pudo crear la media por tener contenido no aprobado por nuestra política de contenidos.';

export type SceneMediaGenerationStage =
  | 'image'
  | 'metadata'
  | 'description'
  | 'audio'
  | 'saving';

export type SceneMediaGenerationProgress = {
  stage: SceneMediaGenerationStage;
  completed: number;
  total: number;
};

export type SceneMediaProgressReporter = (progress: SceneMediaGenerationProgress) => void;

export type GenerateReadySceneMediaInput = {
  createdAssistantMessage?: string;
  format: SceneMediaFormat;
  generationMode: UserSceneMediaGenerationMode;
  layerDecisions?: UserSceneMediaLayerDecisions;
  level: SceneMediaLevel;
  mediaId?: string;
  onProgress?: SceneMediaProgressReporter;
  ownerProfileId: string;
  ownerUserId: string;
  prompt: string;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
  sourceItem?: SceneMediaLibraryItem;
};

export class SceneMediaCreationError extends Error {
  readonly reason: string;

  constructor(
    message: string,
    reason = 'generation_failed',
    options: { cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'SceneMediaCreationError';
    this.reason = reason;
  }
}

export async function generateReadySceneMedia(
  input: GenerateReadySceneMediaInput,
): Promise<CreateReadyUserSceneMediaInput> {
  const mediaId = input.mediaId ?? randomUUID();
  const storage = getUserFileStorageProvider();
  const uploadedKeys: string[] = [];
  const report: SceneMediaProgressReporter = input.onProgress ?? (() => {});

  try {
    const sourceContext = createSourceContext(input);
    const sourceImage = input.sourceItem
      ? await readSceneMediaImageAsset(input.sourceItem)
      : undefined;
    const shouldGenerateImage = !input.sourceItem ||
      input.layerDecisions?.image === 'generate_new';
    report({ stage: 'image', completed: 0, total: 1 });
    const imageResult = shouldGenerateImage
      ? await generateAndStoreImage({
        ...input,
        mediaId,
        referenceImage: sourceImage,
        sourceContext,
      })
      : await reuseImage(input.sourceItem, storage);
    report({ stage: 'image', completed: 1, total: 1 });
    if (
      'uploadedStorageKey' in imageResult &&
      typeof imageResult.uploadedStorageKey === 'string'
    ) {
      uploadedKeys.push(imageResult.uploadedStorageKey);
    }

    const shouldGenerateScript = input.generationMode === 'complete_scene' && (
      !input.sourceItem || input.layerDecisions?.scriptAndAudio === 'generate_new'
    );
    const shouldKeepScript = Boolean(
      input.sourceItem &&
      input.layerDecisions?.scriptAndAudio === 'keep_existing' &&
      input.sourceItem.script &&
      input.sourceItem.audio,
    );
    report({ stage: 'metadata', completed: 0, total: 1 });
    const metadata = await generateMetadata({
      ...input,
      imageAsset: imageResult.asset,
      includeScript: shouldGenerateScript,
      sourceContext,
    });
    report({ stage: 'metadata', completed: 1, total: 1 });
    const script = shouldGenerateScript
      ? metadata.script
      : shouldKeepScript
        ? input.sourceItem?.script
        : undefined;
    const audioResult = shouldGenerateScript && script
      ? await generateAndStoreAudio({
        mediaId,
        onProgress: (completed, total) =>
          report({ stage: 'audio', completed, total }),
        ownerUserId: input.ownerUserId,
        script,
      })
      : shouldKeepScript
        ? await reuseAudio(input.sourceItem, storage)
        : undefined;
    if (
      audioResult &&
      'uploadedStorageKeys' in audioResult &&
      Array.isArray(audioResult.uploadedStorageKeys)
    ) {
      uploadedKeys.push(...audioResult.uploadedStorageKeys);
    }

    const image: SceneMediaImageLayer = {
      ...imageResult.layer,
      alt: metadata.visualSummary.join(' '),
    };
    const generationMode: UserSceneMediaGenerationMode = script && audioResult
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
      authoringMessages: createInitialAuthoringMessages(
        input.prompt,
        snapshot,
        input.createdAssistantMessage,
      ),
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
        audioVoices: audioResult && 'voices' in audioResult
          ? audioResult.voices
          : null,
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
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => storage.deleteObject(key)));
    throw mapCreationError(error);
  }
}

export async function deleteUnpersistedSceneMediaObjects(
  draft: CreateReadyUserSceneMediaInput,
  sourceItem?: SceneMediaLibraryItem,
): Promise<void> {
  const sourceKeys = new Set([
    sourceItem?.image?.storageKey,
    ...(sourceItem?.audio?.clips.map((clip) => clip.storageKey) ?? []),
  ].filter((value): value is string => Boolean(value)));
  const draftKeys = [
    draft.image.storageKey,
    ...(draft.audio?.clips.map((clip) => clip.storageKey) ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value) => !sourceKeys.has(value));
  const storage = getUserFileStorageProvider();
  await Promise.allSettled(draftKeys.map((key) => storage.deleteObject(key)));
}

async function generateAndStoreImage(
  input: GenerateReadySceneMediaInput & {
    mediaId: string;
    referenceImage?: SceneMediaImageAsset;
    sourceContext?: SceneMediaGenerationSourceContext;
  },
): Promise<{
  asset: SceneMediaImageAsset;
  layer: SceneMediaImageLayer;
  uploadedStorageKey: string;
}> {
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

async function reuseImage(
  sourceItem: SceneMediaLibraryItem | undefined,
  storage: ReturnType<typeof getUserFileStorageProvider>,
): Promise<{ asset: SceneMediaImageAsset; layer: SceneMediaImageLayer }> {
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

async function generateMetadata(
  input: GenerateReadySceneMediaInput & {
    imageAsset: SceneMediaImageAsset;
    includeScript: boolean;
    sourceContext?: SceneMediaGenerationSourceContext;
  },
): Promise<GeneratedSceneMediaMetadataPackage & { script?: SceneMediaScript }> {
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

async function generateAndStoreAudio(input: {
  mediaId: string;
  onProgress?: (completed: number, total: number) => void;
  ownerUserId: string;
  script: SceneMediaScript;
}): Promise<{
  layer: SceneMediaAudioLayer;
  uploadedStorageKeys: string[];
  voices: Array<{ speaker: string; voice: string }>;
}> {
  const generated = await generateSceneMediaAudio({
    getOpenRouterApiKey: () => requireCreditKey(input.ownerUserId),
    onClipProgress: input.onProgress,
    script: input.script,
  });
  const storage = getUserFileStorageProvider();
  const uploadedStorageKeys: string[] = [];
  const clips: SceneMediaAudioLayer['clips'] = [];

  try {
    for (const clip of generated.clips) {
      const storageKey = createSceneMediaStorageKey({
        extension: clip.extension,
        fileId: `turn-${String(clip.turn).padStart(2, '0')}`,
        fileRole: 'audio',
        mediaId: input.mediaId,
        userId: input.ownerUserId,
      });
      await storage.putObject({
        body: clip.bytes,
        cacheControl: publicImmutableCacheControl,
        contentType: clip.contentType,
        key: storageKey,
        metadata: {
          mediaId: input.mediaId,
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
  } catch (error) {
    await Promise.allSettled(uploadedStorageKeys.map((key) => storage.deleteObject(key)));
    throw error;
  }

  return {
    layer: {
      clips,
      format: 'wav',
      model: generated.model,
      provider: generated.provider,
      voiceStrategy: generated.voiceStrategy,
    },
    uploadedStorageKeys,
    voices: Array.from(new Map(
      generated.clips.map((clip) => [clip.speaker, {
        speaker: clip.speaker,
        voice: clip.voice,
      }]),
    ).values()),
  };
}

async function reuseAudio(
  sourceItem: SceneMediaLibraryItem | undefined,
  storage: ReturnType<typeof getUserFileStorageProvider>,
): Promise<{ layer: SceneMediaAudioLayer } | undefined> {
  if (!sourceItem?.audio) {
    return undefined;
  }
  const clips = [];
  for (const clip of sourceItem.audio.clips) {
    if (clip.storageKey) {
      await storage.makeObjectPublic(clip.storageKey);
      clips.push({ ...clip, src: storage.createPublicUrl(clip.storageKey) });
    } else {
      clips.push(clip);
    }
  }
  return { layer: { ...sourceItem.audio, clips } };
}

function createSourceContext(
  input: GenerateReadySceneMediaInput,
): SceneMediaGenerationSourceContext | undefined {
  return input.sourceItem && input.layerDecisions
    ? createSceneMediaGenerationSourceContext({
      layerDecisions: input.layerDecisions,
      sourceItem: input.sourceItem,
    })
    : undefined;
}

async function requireCreditKey(userId: string): Promise<string> {
  const key = await getCreditCheckedOpenRouterApiKeyForUser(userId);
  if (!key) {
    throw new SceneMediaCreationError('Missing user OpenRouter API key.', 'provider_not_configured');
  }
  return key;
}

function mapCreationError(error: unknown): Error {
  if (error instanceof SceneMediaCreationError) {
    return error;
  }
  if (
    error instanceof SceneMediaImageContentPolicyError ||
    error instanceof SceneMediaScriptContentPolicyError ||
    error instanceof SceneMediaAudioContentPolicyError
  ) {
    return new SceneMediaCreationError(contentPolicyMessage, 'content_policy');
  }
  if (error instanceof SceneMediaImageProviderError) {
    return new SceneMediaCreationError(
      'Unable to generate this media image.',
      'image_provider_error',
      { cause: error },
    );
  }
  if (error instanceof SceneMediaScriptProviderError) {
    return new SceneMediaCreationError(
      'Unable to generate this media metadata.',
      'script_provider_error',
      { cause: error },
    );
  }
  if (error instanceof SceneMediaAudioProviderError) {
    return new SceneMediaCreationError(
      'Unable to generate this media audio.',
      'audio_provider_error',
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

function createInitialAuthoringMessages(
  prompt: string,
  snapshot: Record<string, unknown>,
  assistantMessage = 'The media was created successfully.',
): SceneMediaAuthoringMessage[] {
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

export function createAuthoringSnapshot(input: {
  audio?: SceneMediaAudioLayer;
  format: SceneMediaFormat;
  image: SceneMediaImageLayer;
  level: SceneMediaLevel;
  script?: SceneMediaScript;
  setting?: string;
  skills: string[];
  tags: string[];
  title: string;
  useCases: string[];
  visualSummary: string[];
}): Record<string, unknown> {
  return { ...input };
}
