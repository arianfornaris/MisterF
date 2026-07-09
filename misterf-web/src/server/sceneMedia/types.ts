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
  width?: number;
};

export type SceneMediaAudioLayer = {
  durationSeconds: number;
  format: 'mp3';
  src: string;
  storageKey?: string;
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
  createdFrom?: {
    baseBuiltInMediaId?: string;
    baseVisualAssetId?: string;
    conversationId?: string;
    prompt?: string;
    resourceId?: string;
  };
  format: SceneMediaFormat;
  id: string;
  image?: SceneMediaImageLayer;
  level?: SceneMediaLevel;
  ownerUserId?: string;
  script?: SceneMediaScript;
  setting?: string;
  skills: string[];
  source: SceneMediaSource;
  status: 'archived' | 'ready';
  tags: string[];
  title: string;
  useCases: string[];
  visualAssetId?: string;
  visualSummary: string[];
};

export type SceneMediaLibraryFilters = {
  format?: SceneMediaFormat;
  level?: SceneMediaLevel;
  query?: string;
};
