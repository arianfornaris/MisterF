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

export type SceneMediaIdentityStrategy =
  | 'named_in_dialogue'
  | 'named_in_narration'
  | 'role_only';

export type SceneMediaSpeakerGender = 'female' | 'male' | 'neutral';

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
  authoringMessages?: SceneMediaAuthoringMessage[];
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
  skills: string[];
  source: SceneMediaSource;
  status: SceneMediaStatus;
  tags: string[];
  title: string;
  updatedAt?: string;
  useCases: string[];
  visualAssetId?: string;
  visualSummary: string[];
};

export type SceneMediaAuthoringMessage = {
  content: string;
  createdAt: string;
  draftSnapshot?: Record<string, unknown>;
  role: 'assistant' | 'user';
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
