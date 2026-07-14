import { getDb } from '../db/database.js';
import type {
  SceneMediaAudioLayer,
  SceneMediaAuthoringMessage,
  SceneMediaFormat,
  SceneMediaImageLayer,
  SceneMediaLevel,
  SceneMediaLibraryItem,
  SceneMediaScript,
  SceneMediaStatus,
  UserSceneMediaGenerationMode,
  UserSceneMediaScriptTypePreference,
} from './types.js';

type UserSceneMediaRow = {
  archived_at: string | null;
  authoring_messages_json: string;
  audio_json: string | null;
  created_at: string;
  created_from_json: string;
  format: SceneMediaFormat;
  generation_mode: UserSceneMediaGenerationMode;
  generation_prompt: string;
  id: string;
  image_json: string | null;
  level: SceneMediaLevel;
  profile_id: string;
  script_json: string | null;
  script_type_preference: UserSceneMediaScriptTypePreference;
  setting: string | null;
  skills_json: string;
  source_media_id: string | null;
  source_visual_asset_id: string | null;
  status: SceneMediaStatus;
  tags_json: string;
  title: string;
  updated_at: string;
  use_cases_json: string;
  user_id: string;
  visual_summary_json: string;
};

export type CreateReadyUserSceneMediaInput = {
  audio?: SceneMediaAudioLayer;
  authoringMessages?: SceneMediaAuthoringMessage[];
  createdFrom?: Record<string, unknown>;
  format: SceneMediaFormat;
  generationMode: UserSceneMediaGenerationMode;
  id: string;
  image: SceneMediaImageLayer;
  level: SceneMediaLevel;
  ownerProfileId: string;
  ownerUserId: string;
  prompt: string;
  provenance?: Record<string, unknown>;
  script?: SceneMediaScript;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
  setting?: string;
  skills: string[];
  sourceMediaId?: string | null;
  sourceVisualAssetId?: string | null;
  tags: string[];
  title: string;
  useCases: string[];
  visualSummary: string[];
};

export type UpdateReadyUserSceneMediaInput = Omit<
  CreateReadyUserSceneMediaInput,
  'createdFrom' | 'id' | 'ownerProfileId' | 'ownerUserId'
> & {
  authoringMessages: SceneMediaAuthoringMessage[];
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
};

export function createReadyUserSceneMedia(
  input: CreateReadyUserSceneMediaInput,
): SceneMediaLibraryItem {
  getDb()
    .prepare(
      `
        INSERT INTO user_scene_media (
          id,
          user_id,
          profile_id,
          source_media_id,
          source_visual_asset_id,
          title,
          status,
          generation_mode,
          generation_prompt,
          script_type_preference,
          format,
          level,
          setting,
          visual_summary_json,
          tags_json,
          skills_json,
          use_cases_json,
          image_json,
          audio_json,
          script_json,
          created_from_json,
          provenance_json,
          authoring_messages_json
        )
        VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.id,
      input.ownerUserId,
      input.ownerProfileId,
      input.sourceMediaId ?? null,
      input.sourceVisualAssetId ?? null,
      input.title,
      input.generationMode,
      input.prompt,
      input.scriptTypePreference,
      input.format,
      input.level,
      input.setting ?? null,
      JSON.stringify(input.visualSummary),
      JSON.stringify(input.tags),
      JSON.stringify(input.skills),
      JSON.stringify(input.useCases),
      JSON.stringify(input.image),
      input.audio ? JSON.stringify(input.audio) : null,
      input.script ? JSON.stringify(input.script) : null,
      JSON.stringify(input.createdFrom ?? {}),
      JSON.stringify(input.provenance ?? {}),
      JSON.stringify(input.authoringMessages ?? []),
    );

  const media = findUserSceneMediaById(input.id);
  if (!media) {
    throw new Error('Failed to create ready user scene media.');
  }
  return media;
}

export function updateReadyUserSceneMedia(
  input: UpdateReadyUserSceneMediaInput,
): SceneMediaLibraryItem | null {
  getDb()
    .prepare(
      `
        UPDATE user_scene_media
        SET title = ?,
            status = 'ready',
            generation_mode = ?,
            generation_prompt = ?,
            script_type_preference = ?,
            format = ?,
            level = ?,
            setting = ?,
            visual_summary_json = ?,
            tags_json = ?,
            skills_json = ?,
            use_cases_json = ?,
            image_json = ?,
            audio_json = ?,
            script_json = ?,
            provenance_json = ?,
            authoring_messages_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `,
    )
    .run(
      input.title,
      input.generationMode,
      input.prompt,
      input.scriptTypePreference,
      input.format,
      input.level,
      input.setting ?? null,
      JSON.stringify(input.visualSummary),
      JSON.stringify(input.tags),
      JSON.stringify(input.skills),
      JSON.stringify(input.useCases),
      JSON.stringify(input.image),
      input.audio ? JSON.stringify(input.audio) : null,
      input.script ? JSON.stringify(input.script) : null,
      JSON.stringify(input.provenance ?? {}),
      JSON.stringify(input.authoringMessages),
      input.mediaId,
      input.ownerUserId,
      input.ownerProfileId,
    );

  return findUserSceneMediaForProfile({
    mediaId: input.mediaId,
    ownerProfileId: input.ownerProfileId,
    ownerUserId: input.ownerUserId,
  });
}

export function updateUserSceneMediaTitle(input: {
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
  title: string;
}): SceneMediaLibraryItem | null {
  getDb()
    .prepare(
      `
        UPDATE user_scene_media
        SET title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `,
    )
    .run(input.title, input.mediaId, input.ownerUserId, input.ownerProfileId);

  return findUserSceneMediaForProfile({
    mediaId: input.mediaId,
    ownerProfileId: input.ownerProfileId,
    ownerUserId: input.ownerUserId,
  });
}

export function updateUserSceneMediaDetails(input: {
  level: SceneMediaLevel;
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
  title: string;
}): SceneMediaLibraryItem | null {
  getDb()
    .prepare(
      `
        UPDATE user_scene_media
        SET title = ?,
            level = ?,
            script_type_preference = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `,
    )
    .run(
      input.title,
      input.level,
      input.scriptTypePreference,
      input.mediaId,
      input.ownerUserId,
      input.ownerProfileId,
    );

  return findUserSceneMediaForProfile({
    mediaId: input.mediaId,
    ownerProfileId: input.ownerProfileId,
    ownerUserId: input.ownerUserId,
  });
}

export function applyUserSceneMediaImage(input: {
  image: SceneMediaImageLayer;
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
}): SceneMediaLibraryItem | null {
  getDb()
    .prepare(
      `
        UPDATE user_scene_media
        SET image_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `,
    )
    .run(
      JSON.stringify(input.image),
      input.mediaId,
      input.ownerUserId,
      input.ownerProfileId,
    );

  return findUserSceneMediaForProfile({
    mediaId: input.mediaId,
    ownerProfileId: input.ownerProfileId,
    ownerUserId: input.ownerUserId,
  });
}

export function applyUserSceneMediaScript(input: {
  audio: SceneMediaAudioLayer;
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
  script: SceneMediaScript;
}): SceneMediaLibraryItem | null {
  getDb()
    .prepare(
      `
        UPDATE user_scene_media
        SET script_json = ?,
            audio_json = ?,
            generation_mode = 'complete_scene',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `,
    )
    .run(
      JSON.stringify(input.script),
      JSON.stringify(input.audio),
      input.mediaId,
      input.ownerUserId,
      input.ownerProfileId,
    );

  return findUserSceneMediaForProfile({
    mediaId: input.mediaId,
    ownerProfileId: input.ownerProfileId,
    ownerUserId: input.ownerUserId,
  });
}

export function updateUserSceneMediaAuthoringMessages(input: {
  mediaId: string;
  messages: SceneMediaAuthoringMessage[];
  ownerProfileId: string;
  ownerUserId: string;
}): SceneMediaLibraryItem | null {
  getDb()
    .prepare(
      `
        UPDATE user_scene_media
        SET authoring_messages_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `,
    )
    .run(
      JSON.stringify(input.messages),
      input.mediaId,
      input.ownerUserId,
      input.ownerProfileId,
    );

  return findUserSceneMediaForProfile({
    mediaId: input.mediaId,
    ownerProfileId: input.ownerProfileId,
    ownerUserId: input.ownerUserId,
  });
}

export function listUserSceneMediaForProfile(input: {
  ownerProfileId: string;
  ownerUserId: string;
}): SceneMediaLibraryItem[] {
  const rows = getDb()
    .prepare(
      `
        SELECT *
        FROM user_scene_media
        WHERE user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(input.ownerUserId, input.ownerProfileId) as UserSceneMediaRow[];

  return rows.map(toSceneMediaLibraryItem);
}

export function findUserSceneMediaForProfile(input: {
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
}): SceneMediaLibraryItem | null {
  const row = getDb()
    .prepare(
      `
        SELECT *
        FROM user_scene_media
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `,
    )
    .get(input.mediaId, input.ownerUserId, input.ownerProfileId) as
    | UserSceneMediaRow
    | undefined;

  return row ? toSceneMediaLibraryItem(row) : null;
}

export function archiveUserSceneMediaForProfile(input: {
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
}): boolean {
  const result = getDb().prepare(
    `
      UPDATE user_scene_media
      SET status = 'archived',
          archived_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
        AND profile_id = ?
        AND archived_at IS NULL
    `,
  ).run(input.mediaId, input.ownerUserId, input.ownerProfileId);

  return result.changes > 0;
}

export function findUserSceneMediaById(mediaId: string): SceneMediaLibraryItem | null {
  const row = getDb()
    .prepare(
      `
        SELECT *
        FROM user_scene_media
        WHERE id = ?
      `,
    )
    .get(mediaId) as UserSceneMediaRow | undefined;

  return row ? toSceneMediaLibraryItem(row) : null;
}

function toSceneMediaLibraryItem(row: UserSceneMediaRow): SceneMediaLibraryItem {
  const image = parseJsonValue<SceneMediaImageLayer>(row.image_json);
  const audio = parseJsonValue<SceneMediaAudioLayer>(row.audio_json);
  const script = parseJsonValue<SceneMediaScript>(row.script_json);
  const createdFrom = parseJsonValue<Record<string, unknown>>(row.created_from_json);

  return {
    archivedAt: row.archived_at,
    authoringMessages: parseAuthoringMessages(row.authoring_messages_json),
    audio: audio ?? undefined,
    createdAt: row.created_at,
    createdFrom: createdFrom ? {
      baseBuiltInMediaId: asOptionalString(createdFrom.baseBuiltInMediaId),
      baseVisualAssetId: asOptionalString(createdFrom.baseVisualAssetId),
      conversationId: asOptionalString(createdFrom.conversationId),
      prompt: asOptionalString(createdFrom.prompt),
      resourceId: asOptionalString(createdFrom.resourceId),
      sourceMediaId: asOptionalString(createdFrom.sourceMediaId),
    } : undefined,
    format: row.format,
    generationMode: row.generation_mode,
    generationPrompt: row.generation_prompt,
    id: row.id,
    image: image ?? undefined,
    level: row.level,
    ownerProfileId: row.profile_id,
    ownerUserId: row.user_id,
    script: script ?? undefined,
    scriptTypePreference: row.script_type_preference,
    setting: row.setting ?? undefined,
    skills: parseStringArray(row.skills_json),
    source: 'user_generated',
    status: row.status,
    tags: parseStringArray(row.tags_json),
    title: row.title,
    updatedAt: row.updated_at,
    useCases: parseStringArray(row.use_cases_json),
    visualAssetId: row.source_visual_asset_id ?? undefined,
    visualSummary: parseStringArray(row.visual_summary_json),
  };
}

function parseAuthoringMessages(value: string): SceneMediaAuthoringMessage[] {
  const parsed = parseJsonValue<unknown>(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((item): SceneMediaAuthoringMessage[] => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const record = item as Record<string, unknown>;
    if (
      (record.role !== 'assistant' && record.role !== 'user') ||
      typeof record.content !== 'string' ||
      typeof record.createdAt !== 'string'
    ) {
      return [];
    }
    return [{
      content: record.content,
      createdAt: record.createdAt,
      draftSnapshot: record.draftSnapshot && typeof record.draftSnapshot === 'object'
        ? record.draftSnapshot as Record<string, unknown>
        : undefined,
      role: record.role,
    }];
  });
}

function parseStringArray(value: string): string[] {
  const parsed = parseJsonValue<unknown>(value);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseJsonValue<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
