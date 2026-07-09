import { assertUserHasLlmCredit, isCreditExhaustedError, } from '../services/creditGate.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
import { findSceneMediaItemById, listSceneMediaItems, normalizeSceneMediaFormat, normalizeSceneMediaLevel, sceneMediaFormats, sceneMediaLevels, } from './library.js';
import { scheduleSceneMediaGenerationJob } from './generation.js';
import { emitSceneMediaGenerationCreated, emitSceneMediaGenerationUpdated, } from './socket.js';
import { archiveUserSceneMediaForProfile, createUserSceneMediaJob, retryUserSceneMediaGenerationJob, } from './userMediaRepository.js';
import { getUserFileStorageProvider } from '../storage/userFileStorage.js';
function ensureVerifiedSceneMediaUser(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return null;
    }
    return { activeProfile, user };
}
export function renderSceneMediaLibraryPage(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const selectedLevel = normalizeSceneMediaLevel(request.query.level);
    const selectedFormat = normalizeSceneMediaFormat(request.query.format);
    const searchQuery = readField(request.query.q, 120);
    const mediaItems = listSceneMediaItems({
        format: selectedFormat,
        level: selectedLevel,
        query: searchQuery,
    }, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    response.render('media-library', {
        ...buildAppShellContext({
            activeProfile: auth.activeProfile,
            authMessage: getHomeAuthMessage(request, auth.user),
            currentView: 'mediaLibrary',
            guestInitialGreeting: '',
            request,
            title: `${response.locals.t('mediaLibrary.title')} · ${appDocumentTitle}`,
            user: auth.user,
        }),
        formatOptions: sceneMediaFormats,
        mediaItems,
        mediaPreviewItemsJson: serializeViewJson(mediaItems.map(toSceneMediaPreviewItem)),
        mediaError: normalizeMediaLibraryError(request.query.media_error),
        sceneMediaLevels,
        selectedFormat,
        selectedLevel,
        searchQuery,
        totalMediaCount: listSceneMediaItems({}, {
            profileId: auth.activeProfile.id,
            userId: auth.user.id,
        }).length,
    });
}
function toSceneMediaPreviewItem(item) {
    return {
        audio: item.audio,
        id: item.id,
        image: item.image,
        script: item.script,
        title: item.title,
    };
}
function serializeViewJson(value) {
    return (JSON.stringify(value) ?? 'null').replace(/[<>&\u2028\u2029]/g, (character) => {
        switch (character) {
            case '<':
                return '\\u003c';
            case '>':
                return '\\u003e';
            case '&':
                return '\\u0026';
            case '\u2028':
                return '\\u2028';
            case '\u2029':
                return '\\u2029';
            default:
                return character;
        }
    });
}
export function renderSceneMediaDetailPage(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    const mediaItem = findSceneMediaItemById(mediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    if (!mediaItem) {
        response.redirect('/media-library');
        return;
    }
    response.render('media-library-show', {
        ...buildAppShellContext({
            activeProfile: auth.activeProfile,
            authMessage: getHomeAuthMessage(request, auth.user),
            currentView: 'mediaLibrary',
            guestInitialGreeting: '',
            request,
            title: `${mediaItem.title} · ${appDocumentTitle}`,
            user: auth.user,
        }),
        formatOptions: sceneMediaFormats,
        mediaItem,
        mediaError: normalizeMediaLibraryError(request.query.media_error),
        returnTo: normalizeMediaLibraryReturnTo(request.query.returnTo),
        sceneMediaLevels,
    });
}
export async function serveSceneMediaImageAsset(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    const mediaItem = findSceneMediaItemById(mediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    const storageKey = mediaItem?.image?.storageKey;
    if (!mediaItem || mediaItem.source !== 'user_generated' || !storageKey) {
        response.sendStatus(404);
        return;
    }
    const readUrl = await getUserFileStorageProvider().createReadUrl({
        expiresInSeconds: 300,
        storageKey,
    });
    response.redirect(readUrl);
}
export async function serveSceneMediaAudioAsset(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    const mediaItem = findSceneMediaItemById(mediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    const storageKey = mediaItem?.audio?.storageKey;
    if (!mediaItem || mediaItem.source !== 'user_generated' || !storageKey) {
        response.sendStatus(404);
        return;
    }
    const readUrl = await getUserFileStorageProvider().createReadUrl({
        expiresInSeconds: 300,
        storageKey,
    });
    response.redirect(readUrl);
}
export async function createSceneMediaFromPrompt(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const prompt = readField(request.body.prompt, 2000);
    const level = normalizeSceneMediaLevel(request.body.level);
    const format = normalizeSceneMediaFormat(request.body.format);
    const generationMode = normalizeGenerationMode(request.body.generationMode);
    const scriptTypePreference = generationMode === 'complete_scene'
        ? normalizeScriptTypePreference(request.body.scriptTypePreference)
        : 'unspecified';
    if (!prompt || !level || !format || !generationMode) {
        response.redirect('/media-library?media_error=invalid_request');
        return;
    }
    try {
        await assertUserHasLlmCredit(auth.user.id);
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            response.redirect('/media-library?media_error=credit_exhausted');
            return;
        }
        throw error;
    }
    const job = createUserSceneMediaJob({
        format,
        generationMode,
        level,
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
        prompt,
        scriptTypePreference,
        type: 'new_media',
    });
    const createdItem = findSceneMediaItemById(job.mediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    if (createdItem) {
        emitSceneMediaGenerationCreated(createdItem);
    }
    scheduleSceneMediaGenerationJob(job.id);
    response.redirect(`/media-library/${encodeURIComponent(job.mediaId)}`);
}
export async function createSceneMediaVariation(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const sourceMediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    const sourceItem = findSceneMediaItemById(sourceMediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    if (!sourceItem) {
        response.redirect('/media-library');
        return;
    }
    const prompt = readField(request.body.prompt, 2000);
    const level = normalizeSceneMediaLevel(request.body.level) ?? sourceItem.level;
    const imageDecision = normalizeImageDecision(request.body.imageDecision);
    const scriptAndAudioDecision = normalizeScriptAndAudioDecision(request.body.scriptAndAudioDecision, sourceItem);
    const format = imageDecision === 'keep_existing'
        ? sourceItem.format
        : normalizeSceneMediaFormat(request.body.format);
    const scriptTypePreference = scriptAndAudioDecision === 'generate_new'
        ? normalizeScriptTypePreference(request.body.scriptTypePreference)
        : 'unspecified';
    if (!prompt || !level || !format || !imageDecision || !scriptAndAudioDecision) {
        response.redirect(`/media-library/${encodeURIComponent(sourceItem.id)}?media_error=invalid_request`);
        return;
    }
    const layerDecisions = {
        image: imageDecision,
        scriptAndAudio: scriptAndAudioDecision,
    };
    const needsGeneratedLayer = imageDecision === 'generate_new' ||
        scriptAndAudioDecision === 'generate_new';
    if (needsGeneratedLayer) {
        try {
            await assertUserHasLlmCredit(auth.user.id);
        }
        catch (error) {
            if (isCreditExhaustedError(error)) {
                response.redirect(`/media-library/${encodeURIComponent(sourceItem.id)}?media_error=credit_exhausted`);
                return;
            }
            throw error;
        }
    }
    const generationMode = scriptAndAudioDecision === 'do_not_include' ? 'image_only' : 'complete_scene';
    const keptImage = imageDecision === 'keep_existing' ? sourceItem.image : undefined;
    const keptScriptAndAudio = scriptAndAudioDecision === 'keep_existing' && sourceItem.script && sourceItem.audio
        ? {
            audio: sourceItem.audio,
            script: sourceItem.script,
        }
        : {};
    const job = createUserSceneMediaJob({
        audio: keptScriptAndAudio.audio,
        createdFrom: {
            baseBuiltInMediaId: sourceItem.source === 'built_in' ? sourceItem.id : undefined,
            baseVisualAssetId: sourceItem.visualAssetId,
            sourceMediaId: sourceItem.id,
        },
        format,
        generationMode,
        image: keptImage,
        layerDecisions,
        level,
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
        prompt,
        script: keptScriptAndAudio.script,
        scriptTypePreference,
        setting: sourceItem.setting,
        skills: sourceItem.skills,
        sourceMediaId: sourceItem.id,
        sourceVisualAssetId: sourceItem.visualAssetId,
        tags: sourceItem.tags,
        title: promptTitle(prompt, sourceItem.title),
        type: 'variation',
        useCases: sourceItem.useCases,
        visualSummary: sourceItem.visualSummary,
    });
    const createdItem = findSceneMediaItemById(job.mediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    if (createdItem) {
        emitSceneMediaGenerationCreated(createdItem);
    }
    scheduleSceneMediaGenerationJob(job.id);
    response.redirect(`/media-library/${encodeURIComponent(job.mediaId)}`);
}
export async function retrySceneMediaGeneration(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    const mediaItem = findSceneMediaItemById(mediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    if (!mediaItem || mediaItem.source !== 'user_generated' || mediaItem.status !== 'failed') {
        response.redirect('/media-library?media_error=invalid_request');
        return;
    }
    try {
        await assertUserHasLlmCredit(auth.user.id);
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            response.redirect(`/media-library/${encodeURIComponent(mediaItem.id)}?media_error=credit_exhausted`);
            return;
        }
        throw error;
    }
    const job = retryUserSceneMediaGenerationJob({
        mediaId: mediaItem.id,
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
    });
    if (!job) {
        response.redirect('/media-library?media_error=invalid_request');
        return;
    }
    const updatedItem = findSceneMediaItemById(job.mediaId, {
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    if (updatedItem) {
        emitSceneMediaGenerationUpdated(updatedItem);
    }
    scheduleSceneMediaGenerationJob(job.id);
    response.redirect(`/media-library/${encodeURIComponent(job.mediaId)}`);
}
export function archiveSceneMedia(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    archiveUserSceneMediaForProfile({
        mediaId,
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
    });
    response.redirect('/media-library');
}
function readField(value, maxLength) {
    if (Array.isArray(value)) {
        return readField(value[0], maxLength);
    }
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}
function normalizeGenerationMode(value) {
    return value === 'image_only' || value === 'complete_scene' ? value : null;
}
function normalizeScriptTypePreference(value) {
    return value === 'dialogue' ||
        value === 'narration' ||
        value === 'monologue'
        ? value
        : 'unspecified';
}
function normalizeImageDecision(value) {
    return value === 'keep_existing' || value === 'generate_new' ? value : null;
}
function normalizeScriptAndAudioDecision(value, sourceItem) {
    if (value === 'keep_existing') {
        return sourceItem.script && sourceItem.audio ? value : null;
    }
    return value === 'generate_new' || value === 'do_not_include' ? value : null;
}
function promptTitle(prompt, sourceTitle) {
    const firstSentence = prompt.replace(/\s+/g, ' ').trim().split(/[.!?]/)[0]?.trim();
    if (!firstSentence) {
        return `Variation of ${sourceTitle}`;
    }
    return firstSentence.length > 64
        ? `${firstSentence.slice(0, 61).trim()}...`
        : firstSentence;
}
function normalizeMediaLibraryReturnTo(value) {
    const returnTo = readField(value, 2000);
    return returnTo === '/media-library' ||
        returnTo.startsWith('/media-library?')
        ? returnTo
        : '/media-library';
}
function normalizeMediaLibraryError(value) {
    const error = readField(value, 80);
    return error === 'credit_exhausted' || error === 'invalid_request' ? error : '';
}
//# sourceMappingURL=handlers.js.map