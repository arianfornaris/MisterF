import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const aiMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: aiMocks.generateText,
}));

const originalEnv = {
  DATABASE_PATH: process.env.DATABASE_PATH,
  ENV_FILE: process.env.ENV_FILE,
};

const airportScriptLine = 'Please place your bag on the belt.';

async function seedOwnerWithMedia(options: {
  email: string;
  profileName: string;
  providerSubject: string;
}): Promise<{ ownerProfileId: string; ownerUserId: string }> {
  const { createExternalUser } = await import('../../src/server/auth/repository.js');
  const { createProfile } = await import('../../src/server/db/repository.js');
  const { createReadyUserSceneMedia } = await import(
    '../../src/server/sceneMedia/userMediaRepository.js'
  );

  const user = createExternalUser({
    email: options.email,
    emailVerified: true,
    fullName: 'Scene Media Resolver Owner',
    provider: 'google',
    providerSubject: options.providerSubject,
  });
  const profile = createProfile({ name: options.profileName, userId: user.id });

  createReadyUserSceneMedia({
    audio: {
      clips: [{
        speaker: 'Agent',
        src: 'https://cdn.example.test/airport/turn-01.wav',
        storageKey: 'misterf/users/owner/scene-media/airport-a1/audio/turn-01.wav',
        turn: 1,
      }],
      format: 'wav',
      voiceStrategy: 'per_turn_clips',
    },
    format: 'single_panel_scene',
    generationMode: 'complete_scene',
    id: 'airport-a1',
    image: {
      alt: 'A traveler at airport security.',
      src: 'https://cdn.example.test/airport/image.webp',
      storageKey: 'misterf/users/owner/scene-media/airport-a1/image/file.webp',
    },
    level: 'A1-A2',
    ownerProfileId: profile.id,
    ownerUserId: user.id,
    prompt: 'Create an airport security scene.',
    script: {
      identityStrategy: 'named_in_dialogue',
      scriptType: 'dialogue',
      speakers: [
        { name: 'Agent', nameSpokenInAudio: true, role: 'security_agent' },
        { name: 'Traveler', nameSpokenInAudio: true, role: 'traveler' },
      ],
      turns: [
        { speaker: 'Agent', text: airportScriptLine },
        { speaker: 'Traveler', text: 'Of course.' },
      ],
    },
    scriptTypePreference: 'dialogue',
    setting: 'Airport security',
    title: 'Airport Security Line',
    visualSummary: ['A traveler speaks with a security officer.'],
  });

  createReadyUserSceneMedia({
    format: 'single_panel_scene',
    generationMode: 'image_only',
    id: 'restaurant-b1',
    image: {
      alt: 'A diner reads a menu.',
      src: 'https://cdn.example.test/restaurant/image.webp',
      storageKey: 'misterf/users/owner/scene-media/restaurant-b1/image/file.webp',
    },
    level: 'B1-B2',
    ownerProfileId: profile.id,
    ownerUserId: user.id,
    prompt: 'Create a restaurant scene.',
    scriptTypePreference: 'unspecified',
    setting: 'Restaurant table',
    title: 'Ordering At A Restaurant',
    visualSummary: ['A diner talks with a waiter.'],
  });

  return { ownerProfileId: profile.id, ownerUserId: user.id };
}

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-scene-media-resolver-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'scene-media-resolver.sqlite');
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();

  const { migrate } = await import('../../src/server/db/migrator.js');
  migrate();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.clearAllMocks();
  vi.resetModules();

  if (originalEnv.DATABASE_PATH === undefined) {
    delete process.env.DATABASE_PATH;
  } else {
    process.env.DATABASE_PATH = originalEnv.DATABASE_PATH;
  }

  if (originalEnv.ENV_FILE === undefined) {
    delete process.env.ENV_FILE;
  } else {
    process.env.ENV_FILE = originalEnv.ENV_FILE;
  }
});

describe('scene media resolver', () => {
  it('returns a validated recommendation for a real catalog id', async () => {
    const owner = await seedOwnerWithMedia({
      email: 'resolver-valid@example.com',
      profileName: 'Resolver valid profile',
      providerSubject: 'resolver-valid',
    });
    aiMocks.generateText.mockResolvedValue({
      text: JSON.stringify({
        confidence: 'high',
        layers: {
          audio: true,
          image: true,
          script: true,
        },
        mediaId: 'airport-a1',
        reason: 'The airport security scene matches travel instructions.',
        strategy: 'existing_media',
      }),
    });
    const { resolveSceneMedia } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const recommendation = await resolveSceneMedia({
      criteria: 'A short A1 airport security listening scene.',
      desiredLayers: ['image', 'audio', 'script'],
      learnerLevel: 'A1-A2',
      openRouterApiKey: 'test-openrouter-key',
      ...owner,
    });

    expect(recommendation).toEqual({
      alternates: [],
      confidence: 'high',
      layers: {
        audio: true,
        image: true,
        script: true,
      },
      mediaId: 'airport-a1',
      reason: 'The airport security scene matches travel instructions.',
      strategy: 'existing_media',
    });
    expect(aiMocks.generateText).toHaveBeenCalledOnce();
    const call = aiMocks.generateText.mock.calls[0]?.[0];
    expect(call?.messages?.[0]?.content).toContain('Compact catalog:');
    expect(call?.messages?.[0]?.content).not.toContain('https://cdn.example.test/');
    expect(call?.messages?.[0]?.content).not.toContain(airportScriptLine);
  });

  it('uses a valid alternate when the primary media id is invalid', async () => {
    const owner = await seedOwnerWithMedia({
      email: 'resolver-alternate@example.com',
      profileName: 'Resolver alternate profile',
      providerSubject: 'resolver-alternate',
    });
    aiMocks.generateText.mockResolvedValue({
      text: JSON.stringify({
        alternates: ['restaurant-b1'],
        confidence: 'medium',
        mediaId: 'invented-media-id',
        reason: 'The alternate is a valid restaurant item.',
        strategy: 'existing_media',
      }),
    });
    const { resolveSceneMedia } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const recommendation = await resolveSceneMedia({
      criteria: 'Restaurant ordering practice.',
      desiredLayers: ['image'],
      openRouterApiKey: 'test-openrouter-key',
      ...owner,
    });

    expect(recommendation).toEqual(expect.objectContaining({
      confidence: 'medium',
      mediaId: 'restaurant-b1',
      strategy: 'existing_media',
    }));
  });

  it('falls back deterministically when the model returns malformed JSON', async () => {
    const owner = await seedOwnerWithMedia({
      email: 'resolver-fallback@example.com',
      profileName: 'Resolver fallback profile',
      providerSubject: 'resolver-fallback',
    });
    aiMocks.generateText.mockResolvedValue({
      text: 'not json',
    });
    const { resolveSceneMedia } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const recommendation = await resolveSceneMedia({
      criteria: 'A restaurant problem.',
      desiredLayers: ['image'],
      openRouterApiKey: 'test-openrouter-key',
      recentMediaIds: ['airport-a1'],
      ...owner,
    });

    expect(recommendation.strategy).toBe('existing_media');
    expect(recommendation.confidence).toBe('low');
    expect(recommendation.mediaId).toBe('restaurant-b1');
  });

  it('reports no match when the owner has no media of their own', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const emptyUser = createExternalUser({
      email: 'resolver-empty@example.com',
      emailVerified: true,
      fullName: 'Resolver Empty',
      provider: 'google',
      providerSubject: 'resolver-empty',
    });
    const emptyProfile = createProfile({
      name: 'Resolver empty profile',
      userId: emptyUser.id,
    });
    const { resolveSceneMedia } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const recommendation = await resolveSceneMedia({
      criteria: 'Any airport scene.',
      openRouterApiKey: 'test-openrouter-key',
      ownerProfileId: emptyProfile.id,
      ownerUserId: emptyUser.id,
    });

    expect(recommendation.strategy).toBe('no_good_match');
    expect(aiMocks.generateText).not.toHaveBeenCalled();
  });

  it('builds a compact catalog limited to the owner media', async () => {
    const owner = await seedOwnerWithMedia({
      email: 'resolver-catalog@example.com',
      profileName: 'Resolver catalog profile',
      providerSubject: 'resolver-catalog',
    });
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const { createReadyUserSceneMedia } = await import(
      '../../src/server/sceneMedia/userMediaRepository.js'
    );
    const otherUser = createExternalUser({
      email: 'resolver-catalog-other@example.com',
      emailVerified: true,
      fullName: 'Resolver Catalog Other',
      provider: 'google',
      providerSubject: 'resolver-catalog-other',
    });
    const otherProfile = createProfile({
      name: 'Resolver catalog other profile',
      userId: otherUser.id,
    });
    createReadyUserSceneMedia({
      format: 'single_panel_scene',
      generationMode: 'image_only',
      id: 'other-owner-media',
      image: {
        alt: 'A park bench.',
        src: 'https://cdn.example.test/park/image.webp',
        storageKey: 'misterf/users/other/scene-media/other-owner-media/image/file.webp',
      },
      level: 'A1-A2',
      ownerProfileId: otherProfile.id,
      ownerUserId: otherUser.id,
      prompt: 'Create a park scene.',
      scriptTypePreference: 'unspecified',
      setting: 'City park',
      title: 'A Walk In The Park',
      visualSummary: ['Two friends sit on a bench.'],
    });

    const { buildCompactSceneMediaCatalog } = await import(
      '../../src/server/services/sceneMediaResolver.js'
    );

    const catalog = buildCompactSceneMediaCatalog({
      learnerLevel: 'A1-A2',
      ...owner,
    });

    expect(catalog.map((item) => item.id)).toEqual(['airport-a1', 'restaurant-b1']);
  });
});
