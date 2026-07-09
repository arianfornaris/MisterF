import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-user-scene-media-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'scene-media.sqlite');
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();

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

describe('user scene media repository', () => {
  it('stores user media jobs under the owning profile only', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      archiveUserSceneMediaForProfile,
      createUserSceneMediaJob,
      failUserSceneMediaJob,
      listUserSceneMediaForProfile,
      retryUserSceneMediaGenerationJob,
    } = await import('../../src/server/sceneMedia/userMediaRepository.js');

    const user = createExternalUser({
      email: 'scene-media-owner@example.com',
      emailVerified: true,
      fullName: 'Scene Media Owner',
      provider: 'google',
      providerSubject: 'scene-media-owner',
    });
    const ownerProfile = createProfile({
      name: 'Owner profile',
      userId: user.id,
    });
    const otherProfile = createProfile({
      name: 'Other profile',
      userId: user.id,
    });

    const image = {
      alt: 'Airport line',
      source: 'built_in' as const,
      src: '/public/scene-media/images/airport.png',
    };
    const script = {
      scriptType: 'dialogue' as const,
      turns: [
        {
          speaker: 'Agent',
          text: 'Where are you flying today?',
        },
      ],
    };
    const audio = {
      durationSeconds: 24,
      format: 'mp3' as const,
      src: '/public/scene-media/audio/airport.mp3',
    };

    const job = createUserSceneMediaJob({
      audio,
      format: 'single_panel_scene',
      generationMode: 'complete_scene',
      image,
      layerDecisions: {
        image: 'keep_existing',
        scriptAndAudio: 'keep_existing',
      },
      level: 'A1-A2',
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
      prompt: 'Make a polite airport variation.',
      script,
      scriptTypePreference: 'unspecified',
      sourceMediaId: 'airport-security-line-01-a1-a2',
      sourceVisualAssetId: 'airport-security-line-01',
      title: 'Airport Variation',
      type: 'variation',
      visualSummary: ['A traveler waits in an airport line.'],
    });

    const ownerItems = listUserSceneMediaForProfile({
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    });
    const otherItems = listUserSceneMediaForProfile({
      ownerProfileId: otherProfile.id,
      ownerUserId: user.id,
    });

    expect(job.mediaId).toEqual(ownerItems[0]?.id);
    expect(ownerItems).toHaveLength(1);
    expect(ownerItems[0]).toEqual(expect.objectContaining({
      audio,
      image,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
      script,
      source: 'user_generated',
      status: 'pending',
      visualAssetId: 'airport-security-line-01',
    }));
    expect(otherItems).toEqual([]);

    const failedItem = failUserSceneMediaJob({
      failureMessage: 'Unable to generate this media.',
      failureReason: 'unexpected_error',
      mediaId: job.mediaId,
    });
    expect(failedItem?.status).toBe('failed');

    const retryJob = retryUserSceneMediaGenerationJob({
      mediaId: job.mediaId,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    });
    expect(retryJob).toEqual(expect.objectContaining({
      mediaId: job.mediaId,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
      status: 'pending',
    }));

    const archived = archiveUserSceneMediaForProfile({
      mediaId: job.mediaId,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    });
    expect(archived).toBe(true);
    expect(listUserSceneMediaForProfile({
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    })).toEqual([]);
  });
});
