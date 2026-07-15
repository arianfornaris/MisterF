export type SceneMediaSource = 'built_in' | 'user_generated';

export type SceneMediaLevel = 'A1-A2' | 'B1-B2' | 'C1';

export type SceneMediaFormat =
  | 'four_panel_wordless_story'
  | 'single_panel_scene'
  | 'two_panel_contrast';

export type SceneMediaImageLayer = {
  alt: string;
  checksumSha256?: string;
  contentType?: string;
  height?: number;
  mediaId?: string;
  source?: SceneMediaSource;
  src: string;
  storageKey?: string;
  width?: number;
};

export type SceneMediaAudioLayer = {
  clips: SceneMediaAudioClip[];
  format: 'wav';
  model?: string;
  provider?: 'openrouter';
  voiceStrategy: 'per_turn_clips';
};

export type SceneMediaAudioClip = {
  speaker: string;
  src: string;
  storageKey?: string;
  turn: number;
};

export const sceneMediaIdentityStrategies = [
  'named_in_dialogue',
  'named_in_narration',
  'role_only',
] as const;

export type SceneMediaIdentityStrategy = (typeof sceneMediaIdentityStrategies)[number];

export const sceneMediaSpeakerGenders = ['female', 'male', 'neutral'] as const;

export type SceneMediaSpeakerGender = (typeof sceneMediaSpeakerGenders)[number];

export const sceneMediaScriptTypes = ['dialogue', 'monologue', 'narration'] as const;

export type SceneMediaScript =
  | {
      identityStrategy: Extract<
        SceneMediaIdentityStrategy,
        'named_in_dialogue' | 'role_only'
      >;
      scriptType: 'dialogue';
      speakers: Array<{
        // Present on built-in library items; the AI user-generation path does
        // not assign gender yet, so it is optional here.
        gender?: SceneMediaSpeakerGender;
        name: string;
        nameSpokenInAudio: boolean;
        role: string;
      }>;
      turns: Array<{
        speaker: string;
        text: string;
      }>;
    }
  | {
      identityStrategy: Extract<
        SceneMediaIdentityStrategy,
        'named_in_narration' | 'role_only'
      >;
      // Speaker gender for a monologue's character; 'neutral' (or omitted) for a
      // narrator. Drives the TTS voice. Present on generated media; optional for
      // backward compatibility with items authored before the field existed.
      gender?: SceneMediaSpeakerGender;
      scriptType: 'monologue' | 'narration';
      text: string;
    };

export type SceneMediaLibraryItem = {
  audio?: SceneMediaAudioLayer;
  archivedAt?: string | null;
  createdFrom?: {
    baseBuiltInMediaId?: string;
    baseVisualAssetId?: string;
    conversationId?: string;
    prompt?: string;
    resourceId?: string;
    sourceMediaId?: string;
  };
  createdAt?: string;
  format: SceneMediaFormat;
  generationMode?: UserSceneMediaGenerationMode;
  generationPrompt?: string;
  id: string;
  image?: SceneMediaImageLayer;
  level?: SceneMediaLevel;
  ownerProfileId?: string;
  ownerUserId?: string;
  script?: SceneMediaScript;
  scriptTypePreference?: UserSceneMediaScriptTypePreference;
  setting?: string;
  source: SceneMediaSource;
  status: SceneMediaStatus;
  title: string;
  updatedAt?: string;
  visualAssetId?: string;
  visualSummary: string[];
};

// The derived descriptive metadata bundle the metadata LLM produces about a
// scene. These describe the image/script; nothing downstream depends on them,
// so they can be regenerated independently to resync with the current scene.
export type SceneMediaDescriptiveMetadata = {
  setting: string;
  title: string;
  visualSummary: string[];
};

// A generated-but-not-applied layer change awaiting the author's approval in
// the change modal. Held in memory (see sceneMediaPreviewStore) between the
// generate and apply requests; `storageKeys` are the temporary objects to
// delete when the preview is superseded or discarded.
export type SceneMediaPendingPreview =
  | {
      createdAt: number;
      // The target format the image was generated with; applied to the media on
      // approval so a layout change (e.g. four panels -> two) sticks.
      format: SceneMediaFormat;
      image: SceneMediaImageLayer;
      prompt: string;
      previewId: string;
      storageKeys: string[];
      type: 'image';
    }
  | {
      // A script draft awaiting approval. The audio is generated only when the
      // author approves the script (see the script apply flow), so a pending
      // script holds no audio and no temporary storage objects yet.
      createdAt: number;
      level: SceneMediaLevel;
      prompt: string;
      previewId: string;
      script: SceneMediaScript;
      scriptTypePreference: UserSceneMediaScriptTypePreference;
      storageKeys: string[];
      type: 'script';
    }
  | {
      // A regenerated descriptive metadata bundle awaiting approval. Text only,
      // so it holds no temporary storage objects.
      createdAt: number;
      metadata: SceneMediaDescriptiveMetadata;
      prompt: string;
      previewId: string;
      storageKeys: string[];
      type: 'metadata';
    };

export type SceneMediaLibraryFilters = {
  format?: SceneMediaFormat;
  level?: SceneMediaLevel;
  query?: string;
};

export type SceneMediaStatus =
  | 'archived'
  | 'ready';

export type UserSceneMediaGenerationMode = 'complete_scene' | 'image_only';

export type UserSceneMediaScriptTypePreference =
  | 'dialogue'
  | 'monologue'
  | 'narration'
  | 'unspecified';

export type UserSceneMediaLayerDecision = 'do_not_include' | 'generate_new' | 'keep_existing';

export type UserSceneMediaLayerDecisions = {
  image: Exclude<UserSceneMediaLayerDecision, 'do_not_include'>;
  scriptAndAudio: UserSceneMediaLayerDecision;
};
