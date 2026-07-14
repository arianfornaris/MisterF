import { getDb } from '../db/database.js';
export function createReadyUserSceneMedia(input) {
    getDb()
        .prepare(`
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
          image_json,
          audio_json,
          script_json,
          created_from_json,
          provenance_json,
          authoring_messages_json
        )
        VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(input.id, input.ownerUserId, input.ownerProfileId, input.sourceMediaId ?? null, input.sourceVisualAssetId ?? null, input.title, input.generationMode, input.prompt, input.scriptTypePreference, input.format, input.level, input.setting ?? null, JSON.stringify(input.visualSummary), JSON.stringify(input.image), input.audio ? JSON.stringify(input.audio) : null, input.script ? JSON.stringify(input.script) : null, JSON.stringify(input.createdFrom ?? {}), JSON.stringify(input.provenance ?? {}), JSON.stringify(input.authoringMessages ?? []));
    const media = findUserSceneMediaById(input.id);
    if (!media) {
        throw new Error('Failed to create ready user scene media.');
    }
    return media;
}
export function updateReadyUserSceneMedia(input) {
    getDb()
        .prepare(`
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
      `)
        .run(input.title, input.generationMode, input.prompt, input.scriptTypePreference, input.format, input.level, input.setting ?? null, JSON.stringify(input.visualSummary), JSON.stringify(input.image), input.audio ? JSON.stringify(input.audio) : null, input.script ? JSON.stringify(input.script) : null, JSON.stringify(input.provenance ?? {}), JSON.stringify(input.authoringMessages), input.mediaId, input.ownerUserId, input.ownerProfileId);
    return findUserSceneMediaForProfile({
        mediaId: input.mediaId,
        ownerProfileId: input.ownerProfileId,
        ownerUserId: input.ownerUserId,
    });
}
export function updateUserSceneMediaTitle(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media
        SET title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `)
        .run(input.title, input.mediaId, input.ownerUserId, input.ownerProfileId);
    return findUserSceneMediaForProfile({
        mediaId: input.mediaId,
        ownerProfileId: input.ownerProfileId,
        ownerUserId: input.ownerUserId,
    });
}
export function updateUserSceneMediaDetails(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media
        SET title = ?,
            level = ?,
            script_type_preference = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `)
        .run(input.title, input.level, input.scriptTypePreference, input.mediaId, input.ownerUserId, input.ownerProfileId);
    return findUserSceneMediaForProfile({
        mediaId: input.mediaId,
        ownerProfileId: input.ownerProfileId,
        ownerUserId: input.ownerUserId,
    });
}
export function applyUserSceneMediaImage(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media
        SET image_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `)
        .run(JSON.stringify(input.image), input.mediaId, input.ownerUserId, input.ownerProfileId);
    return findUserSceneMediaForProfile({
        mediaId: input.mediaId,
        ownerProfileId: input.ownerProfileId,
        ownerUserId: input.ownerUserId,
    });
}
export function applyUserSceneMediaScript(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media
        SET script_json = ?,
            audio_json = ?,
            generation_mode = 'complete_scene',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `)
        .run(JSON.stringify(input.script), JSON.stringify(input.audio), input.mediaId, input.ownerUserId, input.ownerProfileId);
    return findUserSceneMediaForProfile({
        mediaId: input.mediaId,
        ownerProfileId: input.ownerProfileId,
        ownerUserId: input.ownerUserId,
    });
}
export function applyUserSceneMediaMetadata(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media
        SET title = ?,
            setting = ?,
            visual_summary_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `)
        .run(input.metadata.title, input.metadata.setting, JSON.stringify(input.metadata.visualSummary), input.mediaId, input.ownerUserId, input.ownerProfileId);
    return findUserSceneMediaForProfile({
        mediaId: input.mediaId,
        ownerProfileId: input.ownerProfileId,
        ownerUserId: input.ownerUserId,
    });
}
export function updateUserSceneMediaAuthoringMessages(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media
        SET authoring_messages_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `)
        .run(JSON.stringify(input.messages), input.mediaId, input.ownerUserId, input.ownerProfileId);
    return findUserSceneMediaForProfile({
        mediaId: input.mediaId,
        ownerProfileId: input.ownerProfileId,
        ownerUserId: input.ownerUserId,
    });
}
export function listUserSceneMediaForProfile(input) {
    const rows = getDb()
        .prepare(`
        SELECT *
        FROM user_scene_media
        WHERE user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
        ORDER BY updated_at DESC, created_at DESC
      `)
        .all(input.ownerUserId, input.ownerProfileId);
    return rows.map(toSceneMediaLibraryItem);
}
export function findUserSceneMediaForProfile(input) {
    const row = getDb()
        .prepare(`
        SELECT *
        FROM user_scene_media
        WHERE id = ?
          AND user_id = ?
          AND profile_id = ?
          AND archived_at IS NULL
      `)
        .get(input.mediaId, input.ownerUserId, input.ownerProfileId);
    return row ? toSceneMediaLibraryItem(row) : null;
}
export function archiveUserSceneMediaForProfile(input) {
    const result = getDb().prepare(`
      UPDATE user_scene_media
      SET status = 'archived',
          archived_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
        AND profile_id = ?
        AND archived_at IS NULL
    `).run(input.mediaId, input.ownerUserId, input.ownerProfileId);
    return result.changes > 0;
}
export function findUserSceneMediaById(mediaId) {
    const row = getDb()
        .prepare(`
        SELECT *
        FROM user_scene_media
        WHERE id = ?
      `)
        .get(mediaId);
    return row ? toSceneMediaLibraryItem(row) : null;
}
function toSceneMediaLibraryItem(row) {
    const image = parseJsonValue(row.image_json);
    const audio = parseJsonValue(row.audio_json);
    const script = parseJsonValue(row.script_json);
    const createdFrom = parseJsonValue(row.created_from_json);
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
        source: 'user_generated',
        status: row.status,
        title: row.title,
        updatedAt: row.updated_at,
        visualAssetId: row.source_visual_asset_id ?? undefined,
        visualSummary: parseStringArray(row.visual_summary_json),
    };
}
function parseAuthoringMessages(value) {
    const parsed = parseJsonValue(value);
    if (!Array.isArray(parsed)) {
        return [];
    }
    return parsed.flatMap((item) => {
        if (!item || typeof item !== 'object') {
            return [];
        }
        const record = item;
        if ((record.role !== 'assistant' && record.role !== 'user') ||
            typeof record.content !== 'string' ||
            typeof record.createdAt !== 'string') {
            return [];
        }
        return [{
                content: record.content,
                createdAt: record.createdAt,
                draftSnapshot: record.draftSnapshot && typeof record.draftSnapshot === 'object'
                    ? record.draftSnapshot
                    : undefined,
                role: record.role,
            }];
    });
}
function parseStringArray(value) {
    const parsed = parseJsonValue(value);
    return Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === 'string')
        : [];
}
function parseJsonValue(value) {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
function asOptionalString(value) {
    return typeof value === 'string' && value.trim() ? value : undefined;
}
//# sourceMappingURL=userMediaRepository.js.map