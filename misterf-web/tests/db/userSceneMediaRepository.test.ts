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
  it('persists ready media and applies layer updates', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      applyUserSceneMediaImage,
      applyUserSceneMediaScript,
      createReadyUserSceneMedia,
      findUserSceneMediaForProfile,
      updateUserSceneMediaTitle,
    } = await import('../../src/server/sceneMedia/userMediaRepository.js');
    const user = createExternalUser({
      email: 'ready-scene-media@example.com',
      emailVerified: true,
      fullName: 'Ready Scene Media',
      provider: 'google',
      providerSubject: 'ready-scene-media',
    });
    const profile = createProfile({ name: 'Ready media profile', userId: user.id });
    const mediaId = 'ready-media-1';
    const media = createReadyUserSceneMedia({
      format: 'single_panel_scene',
      generationMode: 'image_only',
      id: mediaId,
      image: {
        alt: 'A traveler at an airport desk.',
        contentType: 'image/webp',
        height: 720,
        src: 'https://cdn.example.test/image.webp',
        storageKey: 'misterf/users/user/scene-media/ready-media-1/image/file.webp',
        width: 720,
      },
      level: 'A1-A2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'Create an airport scene.',
      scriptTypePreference: 'unspecified',
      setting: 'Airport desk',
      title: 'At the Airport Desk',
      visualSummary: ['A traveler speaks with an airport agent.'],
    });

    expect(media.status).toBe('ready');

    updateUserSceneMediaTitle({
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      title: 'Airport Check-In',
    });
    expect(findUserSceneMediaForProfile({
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toEqual(expect.objectContaining({
      title: 'Airport Check-In',
    }));

    const revisedScript = {
      identityStrategy: 'named_in_narration' as const,
      scriptType: 'narration' as const,
      text: 'Maya checks her passport before walking to the airport counter.',
    };
    const revisedAudio = {
      clips: [{
        speaker: 'Narrator',
        src: 'https://cdn.example.test/revised-turn-01.wav',
        turn: 1,
      }],
      format: 'wav' as const,
      voiceStrategy: 'per_turn_clips' as const,
    };
    applyUserSceneMediaScript({
      audio: revisedAudio,
      level: 'B1-B2',
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      script: revisedScript,
      scriptTypePreference: 'narration',
    });
    expect(findUserSceneMediaForProfile({
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toEqual(expect.objectContaining({
      audio: revisedAudio,
      generationMode: 'complete_scene',
      level: 'B1-B2',
      script: revisedScript,
      scriptTypePreference: 'narration',
      title: 'Airport Check-In',
    }));

    const revisedImage = {
      alt: 'Two airport check-in scenes shown side by side.',
      contentType: 'image/webp',
      height: 720,
      src: 'https://cdn.example.test/revised-image.webp',
      storageKey: 'misterf/users/user/scene-media/ready-media-1/image/revised.webp',
      width: 1280,
    };
    expect(applyUserSceneMediaImage({
      format: 'two_panel_contrast',
      image: revisedImage,
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toEqual(expect.objectContaining({
      format: 'two_panel_contrast',
      image: revisedImage,
    }));
  });

  it('stores ready media under the owning profile only and archives it', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      archiveUserSceneMediaForProfile,
      createReadyUserSceneMedia,
      listArchivedUserSceneMediaForProfile,
      listUserSceneMediaForProfile,
      restoreUserSceneMediaForProfile,
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
      identityStrategy: 'named_in_dialogue' as const,
      scriptType: 'dialogue' as const,
      speakers: [{
        name: 'Agent',
        nameSpokenInAudio: true,
        role: 'airport_agent',
      }],
      turns: [
        {
          speaker: 'Agent',
          text: 'Where are you flying today?',
        },
      ],
    };
    const audio = {
      clips: [{
        speaker: 'Agent',
        src: '/public/scene-media/audio/airport/turn-01.wav',
        turn: 1,
      }],
      format: 'wav' as const,
      voiceStrategy: 'per_turn_clips' as const,
    };

    const media = createReadyUserSceneMedia({
      audio,
      format: 'single_panel_scene',
      generationMode: 'complete_scene',
      id: 'airport-variation',
      image,
      level: 'A1-A2',
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
      prompt: 'Make a polite airport variation.',
      script,
      scriptTypePreference: 'unspecified',
      sourceMediaId: 'airport-security-line-01-a1-a2',
      sourceVisualAssetId: 'airport-security-line-01',
      title: 'Airport Variation',
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

    expect(media.id).toEqual(ownerItems[0]?.id);
    expect(ownerItems).toHaveLength(1);
    expect(ownerItems[0]).toEqual(expect.objectContaining({
      audio,
      image,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
      script,
      source: 'user_generated',
      status: 'ready',
      visualAssetId: 'airport-security-line-01',
    }));
    expect(otherItems).toEqual([]);

    const archived = archiveUserSceneMediaForProfile({
      mediaId: media.id,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    });
    expect(archived).toBe(true);
    expect(listUserSceneMediaForProfile({
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    })).toEqual([]);
    expect(listArchivedUserSceneMediaForProfile({
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    })).toEqual([
      expect.objectContaining({
        archivedAt: expect.any(String),
        id: media.id,
        status: 'archived',
      }),
    ]);
    expect(listArchivedUserSceneMediaForProfile({
      ownerProfileId: otherProfile.id,
      ownerUserId: user.id,
    })).toEqual([]);

    expect(restoreUserSceneMediaForProfile({
      mediaId: media.id,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    })).toBe(true);
    expect(listArchivedUserSceneMediaForProfile({
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    })).toEqual([]);
    expect(listUserSceneMediaForProfile({
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    })).toEqual([
      expect.objectContaining({
        archivedAt: null,
        id: media.id,
        status: 'ready',
      }),
    ]);
    expect(restoreUserSceneMediaForProfile({
      mediaId: media.id,
      ownerProfileId: ownerProfile.id,
      ownerUserId: user.id,
    })).toBe(false);
  });
});
