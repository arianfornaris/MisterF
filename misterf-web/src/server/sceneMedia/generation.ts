import {
  completeUserSceneMediaJob,
  failUserSceneMediaJob,
  findUserSceneMediaById,
  findUserSceneMediaJobById,
  updateUserSceneMediaJobStatus,
} from './userMediaRepository.js';
import {
  emitSceneMediaGenerationCompleted,
  emitSceneMediaGenerationFailed,
  emitSceneMediaGenerationUpdated,
} from './socket.js';
import { logger, serializeError } from '../services/logger.js';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../services/creditGate.js';
import {
  createSceneMediaStorageKey,
  getUserFileStorageProvider,
  UserFileStorageConfigurationError,
  UserFileStorageOperationError,
} from '../storage/userFileStorage.js';
import {
  generateSceneMediaImage,
  SceneMediaImageContentPolicyError,
  SceneMediaImageProviderError,
} from './imageGeneration.js';
import type {
  SceneMediaImageLayer,
  UserSceneMediaJob,
} from './types.js';
import { findSceneMediaItemById } from './library.js';

const providerNotConfiguredReason = 'provider_not_configured';
const contentPolicyMessage =
  'No se pudo crear la media por tener contenido no aprobado por nuestra política de contenidos.';
const generatedImageCacheControl = 'private, max-age=31536000, immutable';

export function scheduleSceneMediaGenerationJob(jobId: string): void {
  setTimeout(() => {
    void runSceneMediaGenerationJob(jobId);
  }, 0);
}

export async function runSceneMediaGenerationJob(jobId: string): Promise<void> {
  const job = findUserSceneMediaJobById(jobId);
  if (!job || job.status !== 'pending') {
    return;
  }

  try {
    const generatingJob = updateUserSceneMediaJobStatus({
      jobId,
      status: 'generating',
    });
    if (generatingJob) {
      const generatingItem = findUserSceneMediaById(generatingJob.mediaId);
      if (generatingItem) {
        emitSceneMediaGenerationUpdated(generatingItem);
      }
    }

    const requiresGeneratedImage =
      job.type === 'new_media' ||
      job.layerDecisions?.image === 'generate_new';
    const requiresGeneratedScriptAndAudio =
      (job.type === 'new_media' && job.generationMode === 'complete_scene') ||
      job.layerDecisions?.scriptAndAudio === 'generate_new';

    if (requiresGeneratedScriptAndAudio) {
      const failedItem = failUserSceneMediaJob({
        failureMessage: 'Script and audio generation provider is not configured yet.',
        failureReason: providerNotConfiguredReason,
        mediaId: job.mediaId,
      });
      if (failedItem) {
        emitSceneMediaGenerationFailed(failedItem);
      }
      return;
    }

    const generatedImage = requiresGeneratedImage
      ? await generateAndStoreImageLayer(job)
      : undefined;
    const completedItem = completeUserSceneMediaJob({
      image: generatedImage,
      mediaId: job.mediaId,
      status: 'ready',
      visualSummary: generatedImage ? [job.prompt] : undefined,
    });
    if (completedItem) {
      emitSceneMediaGenerationCompleted(completedItem);
    }
  } catch (error) {
    if (error instanceof SceneMediaGenerationFailure) {
      const failedItem = failUserSceneMediaJob({
        failureMessage: error.failureMessage,
        failureReason: error.failureReason,
        mediaId: job.mediaId,
      });
      if (failedItem) {
        emitSceneMediaGenerationFailed(failedItem);
      }
      return;
    }

    logger.error('scene_media_generation_job_failed', {
      error: serializeError(error),
      jobId,
    });
    const failedItem = failUserSceneMediaJob({
      failureMessage: 'Unable to generate this media.',
      failureReason: 'unexpected_error',
      mediaId: job.mediaId,
    });
    if (failedItem) {
      emitSceneMediaGenerationFailed(failedItem);
    }
  }
}

async function generateAndStoreImageLayer(
  job: UserSceneMediaJob,
): Promise<SceneMediaImageLayer> {
  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(
      job.ownerUserId,
    );
    if (!openRouterApiKey) {
      throw new SceneMediaImageProviderError('Missing user OpenRouter API key.');
    }

    const sourceItem = job.sourceMediaId
      ? findSceneMediaItemById(job.sourceMediaId, {
        profileId: job.ownerProfileId,
        userId: job.ownerUserId,
      })
      : null;
    const generatedImage = await generateSceneMediaImage({
      format: job.format,
      level: job.level,
      openRouterApiKey,
      prompt: job.prompt,
      scriptTypePreference: job.scriptTypePreference,
      sourceVisualSummary: sourceItem?.visualSummary,
    });
    const storageKey = createSceneMediaStorageKey({
      extension: generatedImage.extension,
      fileRole: 'image',
      mediaId: job.mediaId,
      userId: job.ownerUserId,
    });
    const storageProvider = getUserFileStorageProvider();
    await storageProvider.putObject({
      body: generatedImage.bytes,
      cacheControl: generatedImageCacheControl,
      contentType: generatedImage.contentType,
      key: storageKey,
      metadata: {
        mediaId: job.mediaId,
        model: generatedImage.model,
        provider: generatedImage.provider,
        userId: job.ownerUserId,
      },
    });

    return {
      alt: `Generated scene media image for: ${job.prompt}`,
      mediaId: job.mediaId,
      source: 'user_generated',
      src: `/media-library/${encodeURIComponent(job.mediaId)}/image`,
      storageKey,
    };
  } catch (error) {
    if (error instanceof SceneMediaImageContentPolicyError) {
      throw new SceneMediaGenerationFailure({
        failureMessage: contentPolicyMessage,
        failureReason: 'content_policy',
      });
    }

    if (
      error instanceof UserFileStorageConfigurationError ||
      error instanceof UserFileStorageOperationError
    ) {
      throw new SceneMediaGenerationFailure({
        failureMessage: 'Unable to store the generated media file.',
        failureReason: 'storage_error',
      });
    }

    if (error instanceof SceneMediaImageProviderError) {
      throw new SceneMediaGenerationFailure({
        failureMessage: 'Unable to generate this media image.',
        failureReason: 'image_provider_error',
      });
    }

    throw error;
  }
}

class SceneMediaGenerationFailure extends Error {
  readonly failureMessage: string;
  readonly failureReason: string;

  constructor(input: {
    failureMessage: string;
    failureReason: string;
  }) {
    super(input.failureMessage);
    this.name = 'SceneMediaGenerationFailure';
    this.failureMessage = input.failureMessage;
    this.failureReason = input.failureReason;
  }
}
