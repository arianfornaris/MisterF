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
  it('persists ready media and authoring history', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      createReadyUserSceneMedia,
      findUserSceneMediaForProfile,
      updateUserSceneMediaAuthoringMessages,
      updateUserSceneMediaDetails,
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
    const initialMessages = [{
      content: 'Create an airport scene.',
      createdAt: '2026-07-10T12:00:00.000Z',
      role: 'user' as const,
    }];

    const media = createReadyUserSceneMedia({
      authoringMessages: initialMessages,
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
      skills: ['Polite questions'],
      tags: ['airport'],
      title: 'At the Airport Desk',
      useCases: ['speaking'],
      visualSummary: ['A traveler speaks with an airport agent.'],
    });

    expect(media.status).toBe('ready');
    expect(media.authoringMessages).toEqual(initialMessages);

    updateUserSceneMediaTitle({
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      title: 'Airport Check-In',
    });
    const revisedMessages = [...initialMessages, {
      content: 'Title updated.',
      createdAt: '2026-07-10T12:01:00.000Z',
      role: 'assistant' as const,
    }];
    updateUserSceneMediaAuthoringMessages({
      mediaId,
      messages: revisedMessages,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    });
    expect(findUserSceneMediaForProfile({
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toEqual(expect.objectContaining({
      authoringMessages: revisedMessages,
      title: 'Airport Check-In',
    }));

    updateUserSceneMediaDetails({
      level: 'B1-B2',
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      scriptTypePreference: 'dialogue',
      title: 'Airport Check-In (edited)',
    });
    expect(findUserSceneMediaForProfile({
      mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toEqual(expect.objectContaining({
      // Manual metadata edits change only labels/preferences, not content.
      authoringMessages: revisedMessages,
      level: 'B1-B2',
      scriptTypePreference: 'dialogue',
      title: 'Airport Check-In (edited)',
    }));
  });

  it('stores ready media under the owning profile only and archives it', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      archiveUserSceneMediaForProfile,
      createReadyUserSceneMedia,
      listUserSceneMediaForProfile,
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
      authoringMessages: [],
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
      skills: [],
      tags: [],
      useCases: [],
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
  });
});
