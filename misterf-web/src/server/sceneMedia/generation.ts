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

const providerNotConfiguredReason = 'provider_not_configured';

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

    const requiresGeneratedLayer =
      job.type === 'new_media' ||
      job.layerDecisions?.image === 'generate_new' ||
      job.layerDecisions?.scriptAndAudio === 'generate_new';

    if (requiresGeneratedLayer) {
      const failedItem = failUserSceneMediaJob({
        failureMessage: 'Media generation provider is not configured yet.',
        failureReason: providerNotConfiguredReason,
        mediaId: job.mediaId,
      });
      if (failedItem) {
        emitSceneMediaGenerationFailed(failedItem);
      }
      return;
    }

    const completedItem = completeUserSceneMediaJob({
      mediaId: job.mediaId,
      status: 'ready',
    });
    if (completedItem) {
      emitSceneMediaGenerationCompleted(completedItem);
    }
  } catch (error) {
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
