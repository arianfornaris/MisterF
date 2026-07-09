export type SceneMediaSource = 'built_in' | 'user_generated';

export type SceneMediaLevel = 'A1-A2' | 'B1-B2' | 'C1';

export type SceneMediaFormat =
  | 'four_panel_wordless_story'
  | 'single_panel_scene'
  | 'two_panel_contrast';

export type SceneMediaImageLayer = {
  alt: string;
  height?: number;
  mediaId?: string;
  source?: SceneMediaSource;
  src: string;
  storageKey?: string;
  width?: number;
};

export type SceneMediaAudioLayer = {
  durationSeconds: number;
  format: 'mp3';
  model?: string;
  provider?: 'openrouter';
  src: string;
  storageKey?: string;
  voices?: Array<{
    speaker: string;
    voice: string;
  }>;
};

export type SceneMediaScript =
  | {
      scriptType: 'dialogue';
      turns: Array<{
        speaker: string;
        text: string;
      }>;
    }
  | {
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
  failureMessage?: string | null;
  failureReason?: string | null;
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

export type SceneMediaLibraryFilters = {
  format?: SceneMediaFormat;
  level?: SceneMediaLevel;
  query?: string;
};

export type SceneMediaStatus =
  | 'archived'
  | 'failed'
  | 'generating'
  | 'pending'
  | 'ready';

export type UserSceneMediaGenerationMode = 'complete_scene' | 'image_only';

export type UserSceneMediaScriptTypePreference =
  | 'dialogue'
  | 'monologue'
  | 'narration'
  | 'unspecified';

export type UserSceneMediaJobStatus =
  | 'archived'
  | 'failed'
  | 'generating'
  | 'pending'
  | 'ready';

export type UserSceneMediaJobType = 'new_media' | 'variation';

export type UserSceneMediaLayerDecision = 'do_not_include' | 'generate_new' | 'keep_existing';

export type UserSceneMediaLayerDecisions = {
  image: Exclude<UserSceneMediaLayerDecision, 'do_not_include'>;
  scriptAndAudio: UserSceneMediaLayerDecision;
};

export type UserSceneMediaJob = {
  createdAt: string;
  failureMessage: string | null;
  failureReason: string | null;
  format: SceneMediaFormat;
  generationMode: UserSceneMediaGenerationMode;
  id: string;
  layerDecisions: UserSceneMediaLayerDecisions | null;
  level: SceneMediaLevel;
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
  prompt: string;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
  sourceMediaId: string | null;
  status: UserSceneMediaJobStatus;
  type: UserSceneMediaJobType;
  updatedAt: string;
};
