import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const creditGateMocks = vi.hoisted(() => ({
  getCreditCheckedOpenRouterApiKeyForUser: vi.fn(),
}));

const imageGenerationMocks = vi.hoisted(() => {
  class SceneMediaImageContentPolicyError extends Error {
    constructor(message = 'Content policy rejected this prompt.') {
      super(message);
      this.name = 'SceneMediaImageContentPolicyError';
    }
  }

  class SceneMediaImageProviderError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SceneMediaImageProviderError';
    }
  }

  return {
    generateSceneMediaImage: vi.fn(),
    SceneMediaImageContentPolicyError,
    SceneMediaImageProviderError,
  };
});

const scriptGenerationMocks = vi.hoisted(() => {
  class SceneMediaScriptContentPolicyError extends Error {
    constructor(message = 'Content policy rejected this script prompt.') {
      super(message);
      this.name = 'SceneMediaScriptContentPolicyError';
    }
  }

  class SceneMediaScriptProviderError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SceneMediaScriptProviderError';
    }
  }

  return {
    generateSceneMediaScriptPackage: vi.fn(),
    SceneMediaScriptContentPolicyError,
    SceneMediaScriptProviderError,
  };
});

const audioGenerationMocks = vi.hoisted(() => {
  class SceneMediaAudioContentPolicyError extends Error {
    constructor(message = 'Content policy rejected this audio script.') {
      super(message);
      this.name = 'SceneMediaAudioContentPolicyError';
    }
  }

  class SceneMediaAudioProviderError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SceneMediaAudioProviderError';
    }
  }

  return {
    generateSceneMediaAudio: vi.fn(),
    SceneMediaAudioContentPolicyError,
    SceneMediaAudioProviderError,
  };
});

const storageMocks = vi.hoisted(() => {
  class UserFileStorageConfigurationError extends Error {}
  class UserFileStorageOperationError extends Error {}

  return {
    createSceneMediaStorageKey: vi.fn(),
    getUserFileStorageProvider: vi.fn(),
    putObject: vi.fn(),
    UserFileStorageConfigurationError,
    UserFileStorageOperationError,
  };
});

vi.mock('../../src/server/services/creditGate.js', () => creditGateMocks);
vi.mock('../../src/server/sceneMedia/imageGeneration.js', () => imageGenerationMocks);
vi.mock('../../src/server/services/sceneMediaScripts.js', () => scriptGenerationMocks);
vi.mock('../../src/server/sceneMedia/audioGeneration.js', () => audioGenerationMocks);
vi.mock('../../src/server/storage/userFileStorage.js', () => ({
  createSceneMediaStorageKey: storageMocks.createSceneMediaStorageKey,
  getUserFileStorageProvider: storageMocks.getUserFileStorageProvider,
  UserFileStorageConfigurationError: storageMocks.UserFileStorageConfigurationError,
  UserFileStorageOperationError: storageMocks.UserFileStorageOperationError,
}));

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-scene-media-runner-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'scene-media-runner.sqlite');
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();
  vi.clearAllMocks();
  creditGateMocks.getCreditCheckedOpenRouterApiKeyForUser.mockResolvedValue(
    'user-openrouter-key',
  );
  imageGenerationMocks.generateSceneMediaImage.mockResolvedValue({
    bytes: Buffer.from('generated-image'),
    contentType: 'image/png',
    extension: 'png',
    model: 'test/image-model',
    prompt: 'image prompt',
    provider: 'openrouter',
  });
  scriptGenerationMocks.generateSceneMediaScriptPackage.mockResolvedValue({
    script: {
      scriptType: 'dialogue',
      turns: [
        {
          speaker: 'Agent',
          text: 'Where are you going today?',
        },
        {
          speaker: 'Traveler',
          text: 'I am going to Boston.',
        },
      ],
    },
    setting: 'Train station',
    skills: ['Travel questions'],
    tags: ['travel', 'tickets'],
    title: 'Train Ticket Conversation',
    useCases: ['listening', 'speaking'],
    visualSummary: ['A traveler buys a ticket at a train station.'],
  });
  audioGenerationMocks.generateSceneMediaAudio.mockResolvedValue({
    bytes: Buffer.from('generated-audio'),
    contentType: 'audio/mpeg',
    durationSeconds: 18.5,
    extension: 'mp3',
    model: 'test-tts-model',
    provider: 'openrouter',
    voices: [
      {
        speaker: 'Agent',
        voice: 'Kore',
      },
      {
        speaker: 'Traveler',
        voice: 'Puck',
      },
    ],
  });
  storageMocks.createSceneMediaStorageKey.mockReturnValue(
    'misterf/users/user_1/scene-media/media_1/image/file_1.png',
  );
  storageMocks.putObject.mockResolvedValue({
    sizeBytes: 15,
    storageKey: 'misterf/users/user_1/scene-media/media_1/image/file_1.png',
  });
  storageMocks.getUserFileStorageProvider.mockReturnValue({
    createReadUrl: vi.fn(),
    deleteObject: vi.fn(),
    putObject: storageMocks.putObject,
  });

  const { migrate } = await import('../../src/server/db/migrator.js');
  migrate();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  if (originalDatabasePath === undefined) {
    delete process.env.DATABASE_PATH;
  } else {
    process.env.DATABASE_PATH = originalDatabasePath;
  }

  if (originalEnvFile === undefined) {
    delete process.env.ENV_FILE;
  } else {
    process.env.ENV_FILE = originalEnvFile;
  }
});

describe('scene media generation runner', () => {
  it('generates, stores, and persists image-only media', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      createUserSceneMediaJob,
      findUserSceneMediaById,
      findUserSceneMediaJobById,
    } = await import('../../src/server/sceneMedia/userMediaRepository.js');
    const { runSceneMediaGenerationJob } = await import(
      '../../src/server/sceneMedia/generation.js'
    );
    const user = createExternalUser({
      email: 'scene-media-runner@example.com',
      emailVerified: true,
      fullName: 'Scene Media Runner',
      provider: 'google',
      providerSubject: 'scene-media-runner',
    });
    const profile = createProfile({
      name: 'Runner profile',
      userId: user.id,
    });
    storageMocks.createSceneMediaStorageKey.mockImplementation((input) => (
      `misterf/users/${input.userId}/scene-media/${input.mediaId}/image/file_1.${input.extension}`
    ));

    const job = createUserSceneMediaJob({
      format: 'single_panel_scene',
      generationMode: 'image_only',
      level: 'A1-A2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'Create an image of a learner buying a train ticket.',
      scriptTypePreference: 'unspecified',
      type: 'new_media',
    });

    await runSceneMediaGenerationJob(job.id);

    const completedJob = findUserSceneMediaJobById(job.id);
    const media = findUserSceneMediaById(job.mediaId);
    expect(completedJob?.status).toBe('ready');
    expect(media).toEqual(expect.objectContaining({
      status: 'ready',
      visualSummary: ['Create an image of a learner buying a train ticket.'],
    }));
    expect(media?.image).toEqual(expect.objectContaining({
      mediaId: job.mediaId,
      source: 'user_generated',
      src: `/media-library/${job.mediaId}/image`,
      storageKey: `misterf/users/${user.id}/scene-media/${job.mediaId}/image/file_1.png`,
    }));
    expect(creditGateMocks.getCreditCheckedOpenRouterApiKeyForUser)
      .toHaveBeenCalledWith(user.id);
    expect(imageGenerationMocks.generateSceneMediaImage).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'single_panel_scene',
        level: 'A1-A2',
        openRouterApiKey: 'user-openrouter-key',
      }),
    );
    expect(storageMocks.putObject).toHaveBeenCalledWith(expect.objectContaining({
      cacheControl: 'private, max-age=31536000, immutable',
      contentType: 'image/png',
      key: `misterf/users/${user.id}/scene-media/${job.mediaId}/image/file_1.png`,
    }));
  });

  it('stores the approved failure message when image generation is blocked', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      createUserSceneMediaJob,
      findUserSceneMediaById,
      findUserSceneMediaJobById,
    } = await import('../../src/server/sceneMedia/userMediaRepository.js');
    const { runSceneMediaGenerationJob } = await import(
      '../../src/server/sceneMedia/generation.js'
    );
    const user = createExternalUser({
      email: 'scene-media-policy@example.com',
      emailVerified: true,
      fullName: 'Scene Media Policy',
      provider: 'google',
      providerSubject: 'scene-media-policy',
    });
    const profile = createProfile({
      name: 'Policy profile',
      userId: user.id,
    });
    imageGenerationMocks.generateSceneMediaImage.mockRejectedValue(
      new imageGenerationMocks.SceneMediaImageContentPolicyError(),
    );
    const job = createUserSceneMediaJob({
      format: 'single_panel_scene',
      generationMode: 'image_only',
      level: 'A1-A2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'Rejected media prompt.',
      scriptTypePreference: 'unspecified',
      type: 'new_media',
    });

    await runSceneMediaGenerationJob(job.id);

    const failedJob = findUserSceneMediaJobById(job.id);
    const media = findUserSceneMediaById(job.mediaId);
    expect(failedJob?.status).toBe('failed');
    expect(failedJob?.failureReason).toBe('content_policy');
    expect(media?.failureMessage).toBe(
      'No se pudo crear la media por tener contenido no aprobado por nuestra política de contenidos.',
    );
    expect(storageMocks.putObject).not.toHaveBeenCalled();
  });

  it('generates script and audio for complete scene media', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      createUserSceneMediaJob,
      findUserSceneMediaById,
      findUserSceneMediaJobById,
    } = await import('../../src/server/sceneMedia/userMediaRepository.js');
    const { runSceneMediaGenerationJob } = await import(
      '../../src/server/sceneMedia/generation.js'
    );
    const user = createExternalUser({
      email: 'scene-media-complete@example.com',
      emailVerified: true,
      fullName: 'Scene Media Complete',
      provider: 'google',
      providerSubject: 'scene-media-complete',
    });
    const profile = createProfile({
      name: 'Complete profile',
      userId: user.id,
    });
    storageMocks.createSceneMediaStorageKey.mockImplementation((input) => (
      `misterf/users/${input.userId}/scene-media/${input.mediaId}/${input.fileRole}/file_1.${input.extension}`
    ));
    const job = createUserSceneMediaJob({
      format: 'single_panel_scene',
      generationMode: 'complete_scene',
      level: 'A1-A2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'Create a train station listening scene.',
      scriptTypePreference: 'dialogue',
      type: 'new_media',
    });

    await runSceneMediaGenerationJob(job.id);

    const completedJob = findUserSceneMediaJobById(job.id);
    const media = findUserSceneMediaById(job.mediaId);
    expect(completedJob?.status).toBe('ready');
    expect(media).toEqual(expect.objectContaining({
      setting: 'Train station',
      skills: ['Travel questions'],
      status: 'ready',
      tags: ['travel', 'tickets'],
      title: 'Train Ticket Conversation',
      useCases: ['listening', 'speaking'],
      visualSummary: ['A traveler buys a ticket at a train station.'],
    }));
    expect(media?.script).toEqual({
      scriptType: 'dialogue',
      turns: [
        {
          speaker: 'Agent',
          text: 'Where are you going today?',
        },
        {
          speaker: 'Traveler',
          text: 'I am going to Boston.',
        },
      ],
    });
    expect(media?.audio).toEqual(expect.objectContaining({
      durationSeconds: 18.5,
      format: 'mp3',
      model: 'test-tts-model',
      provider: 'openrouter',
      src: `/media-library/${job.mediaId}/audio`,
      storageKey: `misterf/users/${user.id}/scene-media/${job.mediaId}/audio/file_1.mp3`,
      voices: [
        {
          speaker: 'Agent',
          voice: 'Kore',
        },
        {
          speaker: 'Traveler',
          voice: 'Puck',
        },
      ],
    }));
    expect(scriptGenerationMocks.generateSceneMediaScriptPackage)
      .toHaveBeenCalledWith(expect.objectContaining({
        format: 'single_panel_scene',
        imageAlt: 'Generated scene media image for: Create a train station listening scene.',
        level: 'A1-A2',
        openRouterApiKey: 'user-openrouter-key',
        scriptTypePreference: 'dialogue',
      }));
    expect(audioGenerationMocks.generateSceneMediaAudio).toHaveBeenCalledWith({
      openRouterApiKey: 'user-openrouter-key',
      script: media?.script,
    });
    expect(storageMocks.putObject).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'image/png',
      key: `misterf/users/${user.id}/scene-media/${job.mediaId}/image/file_1.png`,
    }));
    expect(storageMocks.putObject).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'audio/mpeg',
      key: `misterf/users/${user.id}/scene-media/${job.mediaId}/audio/file_1.mp3`,
    }));
  });

  it('passes complete source media context to variation generators', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const { createUserSceneMediaJob } = await import(
      '../../src/server/sceneMedia/userMediaRepository.js'
    );
    const { runSceneMediaGenerationJob } = await import(
      '../../src/server/sceneMedia/generation.js'
    );
    const user = createExternalUser({
      email: 'scene-media-variation-context@example.com',
      emailVerified: true,
      fullName: 'Scene Media Variation Context',
      provider: 'google',
      providerSubject: 'scene-media-variation-context',
    });
    const profile = createProfile({
      name: 'Variation context profile',
      userId: user.id,
    });
    storageMocks.createSceneMediaStorageKey.mockImplementation((input) => (
      `misterf/users/${input.userId}/scene-media/${input.mediaId}/${input.fileRole}/file_1.${input.extension}`
    ));
    const sourceScript = {
      scriptType: 'dialogue' as const,
      turns: [
        { speaker: 'Officer', text: 'Please place your bag on the belt.' },
        { speaker: 'Traveler', text: 'Should I remove my laptop?' },
      ],
    };
    const sourceJob = createUserSceneMediaJob({
      audio: {
        durationSeconds: 12,
        format: 'mp3',
        src: '/source-audio.mp3',
      },
      format: 'single_panel_scene',
      generationMode: 'complete_scene',
      image: {
        alt: 'A traveler and an officer at an airport security checkpoint.',
        src: '/source-image.png',
      },
      level: 'A1-A2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'Original airport security scene.',
      script: sourceScript,
      scriptTypePreference: 'dialogue',
      setting: 'Airport security checkpoint',
      skills: ['Travel questions', 'Polite requests'],
      status: 'ready',
      tags: ['airport', 'security'],
      title: 'Through Security',
      type: 'new_media',
      useCases: ['listening', 'speaking'],
      visualSummary: [
        'A traveler places a bag on the security belt.',
        'An officer points toward the laptop tray.',
      ],
    });
    const layerDecisions = {
      image: 'generate_new' as const,
      scriptAndAudio: 'generate_new' as const,
    };
    const variationJob = createUserSceneMediaJob({
      format: 'two_panel_contrast',
      generationMode: 'complete_scene',
      layerDecisions,
      level: 'B1-B2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'Show a smoother security experience while keeping the same people.',
      scriptTypePreference: 'dialogue',
      sourceMediaId: sourceJob.mediaId,
      type: 'variation',
    });

    await runSceneMediaGenerationJob(variationJob.id);

    const expectedSourceContext = {
      format: 'single_panel_scene',
      imageAlt: 'A traveler and an officer at an airport security checkpoint.',
      layerDecisions,
      level: 'A1-A2',
      script: sourceScript,
      setting: 'Airport security checkpoint',
      skills: ['Travel questions', 'Polite requests'],
      tags: ['airport', 'security'],
      title: 'Through Security',
      useCases: ['listening', 'speaking'],
      visualSummary: [
        'A traveler places a bag on the security belt.',
        'An officer points toward the laptop tray.',
      ],
    };
    expect(imageGenerationMocks.generateSceneMediaImage).toHaveBeenCalledWith(
      expect.objectContaining({ sourceContext: expectedSourceContext }),
    );
    expect(scriptGenerationMocks.generateSceneMediaScriptPackage).toHaveBeenCalledWith(
      expect.objectContaining({ sourceContext: expectedSourceContext }),
    );
    const imageInput = imageGenerationMocks.generateSceneMediaImage.mock.calls[0]?.[0];
    expect(imageInput?.sourceContext).not.toHaveProperty('audio');
  });
});
