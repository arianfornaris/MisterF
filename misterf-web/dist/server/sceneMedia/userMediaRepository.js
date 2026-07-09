import { randomUUID } from 'node:crypto';
import { getDb } from '../db/database.js';
export function createUserSceneMediaJob(input) {
    const db = getDb();
    const mediaId = randomUUID();
    const jobId = randomUUID();
    const status = input.status ?? 'pending';
    const title = input.title ?? titleFromPrompt(input.prompt);
    const createdFrom = {
        ...(input.createdFrom ?? {}),
        prompt: input.prompt,
        sourceMediaId: input.sourceMediaId ?? undefined,
    };
    const insertMedia = db.prepare(`
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
        provenance_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertJob = db.prepare(`
      INSERT INTO user_scene_media_generation_jobs (
        id,
        media_id,
        user_id,
        profile_id,
        type,
        prompt,
        status,
        generation_mode,
        script_type_preference,
        format,
        level,
        source_media_id,
        layer_decisions_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const transaction = db.transaction(() => {
        insertMedia.run(mediaId, input.ownerUserId, input.ownerProfileId, input.sourceMediaId ?? null, input.sourceVisualAssetId ?? input.visualAssetId ?? null, title, status, input.generationMode, input.prompt, input.scriptTypePreference, input.format, input.level, input.setting ?? null, JSON.stringify(input.visualSummary ?? []), JSON.stringify(input.tags ?? []), JSON.stringify(input.skills ?? []), JSON.stringify(input.useCases ?? []), input.image ? JSON.stringify(input.image) : null, input.audio ? JSON.stringify(input.audio) : null, input.script ? JSON.stringify(input.script) : null, JSON.stringify(createdFrom), JSON.stringify({
            layerDecisions: input.layerDecisions ?? null,
            sourceMediaId: input.sourceMediaId ?? null,
            sourceVisualAssetId: input.sourceVisualAssetId ?? input.visualAssetId ?? null,
        }));
        insertJob.run(jobId, mediaId, input.ownerUserId, input.ownerProfileId, input.type, input.prompt, status, input.generationMode, input.scriptTypePreference, input.format, input.level, input.sourceMediaId ?? null, input.layerDecisions ? JSON.stringify(input.layerDecisions) : null);
    });
    transaction();
    const job = findUserSceneMediaJobById(jobId);
    if (!job) {
        throw new Error('Failed to create user scene media job.');
    }
    return job;
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
export function findUserSceneMediaJobById(jobId) {
    const row = getDb()
        .prepare(`
        SELECT *
        FROM user_scene_media_generation_jobs
        WHERE id = ?
      `)
        .get(jobId);
    return row ? toUserSceneMediaJob(row) : null;
}
export function updateUserSceneMediaJobStatus(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media_generation_jobs
        SET status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(input.status, input.jobId);
    const job = findUserSceneMediaJobById(input.jobId);
    if (job) {
        updateUserSceneMediaStatus({
            mediaId: job.mediaId,
            status: input.status,
        });
    }
    return job;
}
export function completeUserSceneMediaJob(input) {
    const db = getDb();
    const updateMedia = db.prepare(`
      UPDATE user_scene_media
      SET status = 'ready',
          title = COALESCE(?, title),
          setting = COALESCE(?, setting),
          visual_summary_json = COALESCE(?, visual_summary_json),
          tags_json = COALESCE(?, tags_json),
          skills_json = COALESCE(?, skills_json),
          use_cases_json = COALESCE(?, use_cases_json),
          image_json = COALESCE(?, image_json),
          audio_json = COALESCE(?, audio_json),
          script_json = COALESCE(?, script_json),
          source_visual_asset_id = COALESCE(?, source_visual_asset_id),
          failure_reason = NULL,
          failure_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const updateJobs = db.prepare(`
      UPDATE user_scene_media_generation_jobs
      SET status = 'ready',
          failure_reason = NULL,
          failure_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE media_id = ?
    `);
    const transaction = db.transaction(() => {
        updateMedia.run(input.title ?? null, input.setting ?? null, input.visualSummary ? JSON.stringify(input.visualSummary) : null, input.tags ? JSON.stringify(input.tags) : null, input.skills ? JSON.stringify(input.skills) : null, input.useCases ? JSON.stringify(input.useCases) : null, input.image ? JSON.stringify(input.image) : null, input.audio ? JSON.stringify(input.audio) : null, input.script ? JSON.stringify(input.script) : null, input.visualAssetId ?? null, input.mediaId);
        updateJobs.run(input.mediaId);
    });
    transaction();
    return findUserSceneMediaById(input.mediaId);
}
export function failUserSceneMediaJob(input) {
    const db = getDb();
    const updateMedia = db.prepare(`
      UPDATE user_scene_media
      SET status = 'failed',
          failure_reason = ?,
          failure_message = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const updateJobs = db.prepare(`
      UPDATE user_scene_media_generation_jobs
      SET status = 'failed',
          failure_reason = ?,
          failure_message = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE media_id = ?
    `);
    const transaction = db.transaction(() => {
        updateMedia.run(input.failureReason, input.failureMessage, input.mediaId);
        updateJobs.run(input.failureReason, input.failureMessage, input.mediaId);
    });
    transaction();
    return findUserSceneMediaById(input.mediaId);
}
function updateUserSceneMediaStatus(input) {
    getDb()
        .prepare(`
        UPDATE user_scene_media
        SET status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(input.status, input.mediaId);
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
        failureMessage: row.failure_message,
        failureReason: row.failure_reason,
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
function toUserSceneMediaJob(row) {
    return {
        createdAt: row.created_at,
        failureMessage: row.failure_message,
        failureReason: row.failure_reason,
        format: row.format,
        generationMode: row.generation_mode,
        id: row.id,
        layerDecisions: parseJsonValue(row.layer_decisions_json),
        level: row.level,
        mediaId: row.media_id,
        ownerProfileId: row.profile_id,
        ownerUserId: row.user_id,
        prompt: row.prompt,
        scriptTypePreference: row.script_type_preference,
        sourceMediaId: row.source_media_id,
        status: row.status,
        type: row.type,
        updatedAt: row.updated_at,
    };
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
function titleFromPrompt(prompt) {
    const normalized = prompt.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return 'Untitled media';
    }
    const firstSentence = normalized.split(/[.!?]/)[0]?.trim() || normalized;
    return firstSentence.length > 64
        ? `${firstSentence.slice(0, 61).trim()}...`
        : firstSentence;
}
//# sourceMappingURL=userMediaRepository.js.map