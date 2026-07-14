import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const creditMocks = vi.hoisted(() => ({
  getCreditCheckedOpenRouterApiKeyForUser: vi.fn(),
}));

const imageMocks = vi.hoisted(() => {
  class SceneMediaImageContentPolicyError extends Error {}
  class SceneMediaImageProviderError extends Error {}
  return {
    generateSceneMediaImage: vi.fn(),
    SceneMediaImageContentPolicyError,
    SceneMediaImageProviderError,
  };
});

const scriptMocks = vi.hoisted(() => {
  class SceneMediaScriptContentPolicyError extends Error {}
  class SceneMediaScriptProviderError extends Error {}
  return {
    generateSceneMediaMetadataPackage: vi.fn(),
    generateSceneMediaScriptPackage: vi.fn(),
    SceneMediaScriptContentPolicyError,
    SceneMediaScriptProviderError,
  };
});

const audioMocks = vi.hoisted(() => {
  class SceneMediaAudioContentPolicyError extends Error {}
  class SceneMediaAudioProviderError extends Error {}
  return {
    generateSceneMediaAudio: vi.fn(),
    SceneMediaAudioContentPolicyError,
    SceneMediaAudioProviderError,
  };
});

const storageMocks = vi.hoisted(() => ({
  createPublicUrl: vi.fn(),
  createSceneMediaStorageKey: vi.fn(),
  deleteObject: vi.fn(),
  makeObjectPublic: vi.fn(),
  putObject: vi.fn(),
}));

const assetMocks = vi.hoisted(() => ({
  readSceneMediaImageAsset: vi.fn(),
}));

vi.mock('../../src/server/services/creditGate.js', () => creditMocks);
vi.mock('../../src/server/sceneMedia/imageGeneration.js', () => imageMocks);
vi.mock('../../src/server/services/sceneMediaScripts.js', () => scriptMocks);
vi.mock('../../src/server/sceneMedia/audioGeneration.js', () => audioMocks);
vi.mock('../../src/server/sceneMedia/imageAssets.js', () => assetMocks);
vi.mock('../../src/server/storage/userFileStorage.js', () => ({
  createSceneMediaStorageKey: storageMocks.createSceneMediaStorageKey,
  getUserFileStorageProvider: () => ({
    createPublicUrl: storageMocks.createPublicUrl,
    createReadUrl: vi.fn(),
    deleteObject: storageMocks.deleteObject,
    makeObjectPublic: storageMocks.makeObjectPublic,
    putObject: storageMocks.putObject,
  }),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  creditMocks.getCreditCheckedOpenRouterApiKeyForUser.mockResolvedValue('user-key');
  const sourcePng = await sharp({
    create: {
      background: { alpha: 1, b: 80, g: 120, r: 180 },
      channels: 4,
      height: 640,
      width: 960,
    },
  }).png().toBuffer();
  imageMocks.generateSceneMediaImage.mockResolvedValue({
    bytes: sourcePng,
    contentType: 'image/png',
    extension: 'png',
    model: 'test-image-model',
    prompt: 'generated prompt',
    provider: 'openrouter',
  });
  assetMocks.readSceneMediaImageAsset.mockResolvedValue({
    bytes: sourcePng,
    contentType: 'image/png',
  });
  scriptMocks.generateSceneMediaScriptPackage.mockResolvedValue({
    script: {
      identityStrategy: 'named_in_dialogue',
      scriptType: 'dialogue',
      speakers: [
        { name: 'Clerk', nameSpokenInAudio: true, role: 'ticket_clerk' },
        { name: 'Learner', nameSpokenInAudio: true, role: 'traveler' },
      ],
      turns: [
        { speaker: 'Clerk', text: 'How can I help you?' },
        { speaker: 'Learner', text: 'I would like a ticket, please.' },
      ],
    },
    setting: 'Train station',
    title: 'Buying a Train Ticket',
    visualSummary: ['A learner buys a ticket from a clerk.'],
  });
  scriptMocks.generateSceneMediaMetadataPackage.mockResolvedValue({
    setting: 'Train station',
    title: 'Buying a Train Ticket',
    visualSummary: ['A learner buys a ticket from a clerk.'],
  });
  audioMocks.generateSceneMediaAudio.mockResolvedValue({
    clips: [{
      bytes: Buffer.from('audio'),
      contentType: 'audio/wav',
      extension: 'wav',
      speaker: 'Clerk',
      turn: 1,
      voice: 'Kore',
    }],
    model: 'test-tts-model',
    provider: 'openrouter',
    voiceStrategy: 'per_turn_clips',
  });
  storageMocks.createSceneMediaStorageKey.mockImplementation((input) => (
    `misterf/users/${input.userId}/scene-media/${input.mediaId}/${input.fileRole}/file.${input.extension}`
  ));
  storageMocks.createPublicUrl.mockImplementation(
    (key: string) => `https://public.example.test/${key}`,
  );
  storageMocks.putObject.mockResolvedValue({ sizeBytes: 1, storageKey: 'key' });
});

describe('synchronous scene media creation', () => {
  it('returns a complete ready draft with a normalized public image', async () => {
    const { generateReadySceneMedia } = await import(
      '../../src/server/sceneMedia/creation.js'
    );
    const draft = await generateReadySceneMedia({
      format: 'single_panel_scene',
      generationMode: 'complete_scene',
      level: 'A1-A2',
      mediaId: 'media-1',
      ownerProfileId: 'profile-1',
      ownerUserId: 'user-1',
      prompt: 'Create a train ticket scene.',
      scriptTypePreference: 'dialogue',
    });

    expect(draft).toEqual(expect.objectContaining({
      generationMode: 'complete_scene',
      title: 'Buying a Train Ticket',
    }));
    expect(draft.image).toEqual(expect.objectContaining({
      contentType: 'image/webp',
      height: 720,
      src: expect.stringMatching(/^https:\/\/public\.example\.test\//),
      width: 720,
    }));
    expect(draft.script).toBeDefined();
    expect(draft.audio?.clips[0]?.src).toMatch(/^https:\/\/public\.example\.test\//);
    expect(scriptMocks.generateSceneMediaScriptPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBytes: expect.any(Buffer),
        imageContentType: 'image/webp',
      }),
    );
    const imageUpload = storageMocks.putObject.mock.calls.find(
      ([input]) => input.contentType === 'image/webp',
    )?.[0];
    expect(imageUpload).toEqual(expect.objectContaining({
      cacheControl: 'public, max-age=31536000, immutable',
      visibility: 'public-read',
    }));
    expect(await sharp(imageUpload.body).metadata()).toEqual(expect.objectContaining({
      format: 'webp',
      height: 720,
      width: 720,
    }));
  });

  it('sends the source image as an image-to-image reference for variations', async () => {
    const { generateReadySceneMedia } = await import(
      '../../src/server/sceneMedia/creation.js'
    );
    await generateReadySceneMedia({
      format: 'single_panel_scene',
      generationMode: 'image_only',
      layerDecisions: {
        image: 'generate_new',
        scriptAndAudio: 'do_not_include',
      },
      level: 'B1-B2',
      mediaId: 'media-variation',
      ownerProfileId: 'profile-1',
      ownerUserId: 'user-1',
      prompt: 'Change the coat from blue to red.',
      scriptTypePreference: 'unspecified',
      sourceItem: {
        format: 'single_panel_scene',
        id: 'source-media',
        image: { alt: 'A person in a blue coat.', src: '/source.png' },
        level: 'B1-B2',
        source: 'built_in',
        status: 'ready',
        title: 'Blue Coat',
        visualSummary: ['A person wears a blue coat.'],
      },
    });

    expect(imageMocks.generateSceneMediaImage).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImages: [expect.objectContaining({ contentType: 'image/png' })],
      }),
    );
    expect(scriptMocks.generateSceneMediaMetadataPackage).toHaveBeenCalledWith(
      expect.objectContaining({ imageBytes: expect.any(Buffer) }),
    );
  });

  it('uses explicit target level and script type for a script preview', async () => {
    const { generateSceneMediaScriptDraft } = await import(
      '../../src/server/sceneMedia/sceneMediaPreview.js'
    );
    await generateSceneMediaScriptDraft({
      level: 'C1',
      media: {
        format: 'single_panel_scene',
        id: 'media-script-preview',
        image: { alt: 'A traveler speaks with a ticket clerk.', src: '/source.png' },
        level: 'A1-A2',
        scriptTypePreference: 'dialogue',
        source: 'user_generated',
        status: 'ready',
        title: 'Buying a Ticket',
        visualSummary: ['A traveler stands at a ticket counter.'],
      },
      ownerUserId: 'user-1',
      prompt: 'Use more nuanced language.',
      scriptTypePreference: 'monologue',
    });

    expect(scriptMocks.generateSceneMediaScriptPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'C1',
        prompt: 'Use more nuanced language.',
        scriptTypePreference: 'monologue',
      }),
    );
  });
});
