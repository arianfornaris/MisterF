import { isCreditExhaustedError, } from '../services/creditGate.js';
import { buildDocumentTitle, buildAppShellContext, formatRelativeTime, getHomeAuthMessage, } from '../pages/shell.js';
import { findSceneMediaItemById, listSceneMediaItems, normalizeSceneMediaFormat, normalizeSceneMediaLevel, sceneMediaFormats, sceneMediaLevels, } from './library.js';
import { applyUserSceneMediaImage, applyUserSceneMediaMetadata, applyUserSceneMediaScript, archiveUserSceneMediaForProfile, createReadyUserSceneMedia, listArchivedUserSceneMediaForProfile, restoreUserSceneMediaForProfile, updateUserSceneMediaTitle, } from './userMediaRepository.js';
import { generateAndStoreSceneMediaAudio, generateSceneMediaImagePreview, generateSceneMediaMetadataDraft, generateSceneMediaScriptDraft, generateSceneMediaTitleDraft, readSceneMediaReferenceImage, } from './sceneMediaPreview.js';
import { deletePendingPreview, getPendingPreview, setPendingPreview, } from './sceneMediaPreviewStore.js';
import { randomUUID } from 'node:crypto';
import { getUserFileStorageProvider } from '../storage/userFileStorage.js';
import { deleteUnpersistedSceneMediaObjects, generateReadySceneMedia, SceneMediaCreationError, } from './creation.js';
import { logger, serializeError } from '../services/logger.js';
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
            title: buildDocumentTitle(request.locale, response.locals.t('mediaLibrary.title')),
            user: auth.user,
        }),
        formatOptions: sceneMediaFormats,
        mediaItems,
        mediaPreviewItemsJson: serializeViewJson(mediaItems.map(toSceneMediaPreviewItem)),
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
export function renderSceneMediaTrashPage(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaItems = listArchivedUserSceneMediaForProfile({
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
    }).map((item) => ({
        ...item,
        relativeArchivedAt: formatRelativeTime(item.archivedAt ?? item.updatedAt ?? ''),
    }));
    response.render('media-library-trash', {
        ...buildAppShellContext({
            activeProfile: auth.activeProfile,
            authMessage: getHomeAuthMessage(request, auth.user),
            currentView: 'mediaLibrary',
            guestInitialGreeting: '',
            request,
            title: buildDocumentTitle(request.locale, response.locals.t('mediaLibrary.trash')),
            user: auth.user,
        }),
        mediaItems,
    });
}
export function renderNewSceneMediaPage(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    renderSceneMediaNewView(request, response, auth, {
        error: '',
        form: defaultNewMediaForm(),
    });
}
function renderSceneMediaNewView(request, response, auth, input) {
    response.render('media-library-new', {
        ...buildAppShellContext({
            activeProfile: auth.activeProfile,
            authMessage: getHomeAuthMessage(request, auth.user),
            currentView: 'mediaLibrary',
            guestInitialGreeting: '',
            request,
            title: buildDocumentTitle(request.locale, response.locals.t('mediaLibrary.createMedia')),
            user: auth.user,
        }),
        creditExhausted: Boolean(input.creditExhausted),
        error: input.error,
        form: input.form,
        formatOptions: sceneMediaFormats,
        sceneMediaLevels,
    });
}
export function renderNewSceneMediaVariationPage(request, response) {
    const resolved = resolveSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    renderSceneMediaVariationView(request, response, resolved, {
        error: '',
        form: defaultVariationForm(resolved.mediaItem),
    });
}
function renderSceneMediaVariationView(request, response, resolved, input) {
    response.render('media-library-variation-new', {
        ...buildAppShellContext({
            activeProfile: resolved.activeProfile,
            authMessage: getHomeAuthMessage(request, resolved.user),
            currentView: 'mediaLibrary',
            guestInitialGreeting: '',
            request,
            title: buildDocumentTitle(request.locale, response.locals.t('mediaLibrary.createVariation')),
            user: resolved.user,
        }),
        creditExhausted: Boolean(input.creditExhausted),
        error: input.error,
        form: input.form,
        formatOptions: sceneMediaFormats,
        sceneMediaLevels,
        sourceMedia: resolved.mediaItem,
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
            title: buildDocumentTitle(request.locale, mediaItem.title),
            user: auth.user,
        }),
        formatOptions: sceneMediaFormats,
        mediaItem,
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
function wantsProgressStream(request) {
    return Boolean(request.get('accept')?.includes('application/x-ndjson'));
}
function sceneMediaProgressPercent(progress) {
    switch (progress.stage) {
        case 'image':
            return progress.completed >= progress.total ? 40 : 12;
        case 'metadata':
        case 'description':
            return progress.completed >= progress.total ? 58 : 46;
        case 'audio': {
            const ratio = progress.total > 0 ? progress.completed / progress.total : 0;
            return Math.min(92, 60 + Math.round(ratio * 32));
        }
        case 'saving':
            return 96;
    }
}
function sceneMediaProgressMessage(t, progress) {
    switch (progress.stage) {
        case 'image':
            return t('mediaLibrary.progress.image');
        case 'metadata':
            return t('mediaLibrary.progress.metadata');
        case 'description':
            return t('mediaLibrary.progress.description');
        case 'audio':
            return t('mediaLibrary.progress.audio', {
                completed: progress.completed,
                total: progress.total,
            });
        case 'saving':
            return t('mediaLibrary.progress.saving');
    }
}
// Opens a newline-delimited JSON progress stream on the response and returns
// writers for raw payloads and for translated progress events. The HTTP status
// stays 200; terminal `done`/`error` events are written in-band.
function openSceneMediaProgressStream(response) {
    const t = response.locals.t;
    response.status(200);
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    const write = (payload) => {
        response.write(`${JSON.stringify(payload)}\n`);
    };
    return {
        write,
        writeProgress: (progress) => write({
            message: sceneMediaProgressMessage(t, progress),
            percent: sceneMediaProgressPercent(progress),
            type: 'progress',
        }),
    };
}
// Runs the (long) generation while streaming newline-delimited JSON progress
// events to the client instead of blocking on a single redirect. Emits
// `progress` events per stage, then a final `done` (with the redirect target)
// or `error` event. Errors are reported in-band so the already-flushed stream
// can surface them; the HTTP status stays 200.
async function streamSceneMediaGeneration(response, options) {
    const t = response.locals.t;
    response.status(200);
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    const write = (payload) => {
        response.write(`${JSON.stringify(payload)}\n`);
    };
    const savingProgress = {
        stage: 'saving',
        completed: 1,
        total: 1,
    };
    try {
        const draft = await generateReadySceneMedia({
            ...options.generateInput,
            onProgress: (progress) => write({
                message: sceneMediaProgressMessage(t, progress),
                percent: sceneMediaProgressPercent(progress),
                type: 'progress',
            }),
        });
        write({
            message: sceneMediaProgressMessage(t, savingProgress),
            percent: sceneMediaProgressPercent(savingProgress),
            type: 'progress',
        });
        let media;
        try {
            media = createReadyUserSceneMedia(draft);
        }
        catch (error) {
            await options.cleanup(draft);
            throw error;
        }
        write({
            percent: 100,
            redirect: `/media-library/${encodeURIComponent(media.id)}`,
            type: 'done',
        });
    }
    catch (error) {
        logger.error(options.logEvent, {
            error: serializeError(error),
            ...options.logContext,
        });
        write({
            creditExhausted: isCreditExhaustedError(error),
            message: sceneMediaCreationFailureMessage(response, error),
            type: 'error',
        });
    }
    finally {
        response.end();
    }
}
export async function createSceneMediaFromPrompt(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const form = readNewMediaForm(request);
    const { format, generationMode, level, prompt, scriptTypePreference } = form;
    if (!prompt || !level || !format || !generationMode) {
        renderSceneMediaNewView(request, response.status(422), auth, {
            error: response.locals.t('mediaLibrary.invalidRequest'),
            form,
        });
        return;
    }
    const generateInput = {
        format,
        generationMode,
        level,
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
        prompt,
        scriptTypePreference,
    };
    if (wantsProgressStream(request)) {
        await streamSceneMediaGeneration(response, {
            cleanup: (draft) => deleteUnpersistedSceneMediaObjects(draft),
            generateInput,
            logContext: { userId: auth.user.id },
            logEvent: 'scene_media_creation_failed',
        });
        return;
    }
    try {
        const draft = await generateReadySceneMedia(generateInput);
        let media;
        try {
            media = createReadyUserSceneMedia(draft);
        }
        catch (error) {
            await deleteUnpersistedSceneMediaObjects(draft);
            throw error;
        }
        response.redirect(`/media-library/${encodeURIComponent(media.id)}`);
    }
    catch (error) {
        logger.error('scene_media_creation_failed', {
            error: serializeError(error),
            userId: auth.user.id,
        });
        renderSceneMediaNewView(request, response.status(422), auth, {
            creditExhausted: isCreditExhaustedError(error),
            error: sceneMediaCreationFailureMessage(response, error),
            form,
        });
    }
}
export async function createSceneMediaVariation(request, response) {
    const resolved = resolveSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const { activeProfile, mediaItem: sourceItem, user } = resolved;
    const form = readVariationForm(request, sourceItem);
    const { format, imageDecision, level, prompt, scriptAndAudioDecision, scriptTypePreference, } = form;
    if (!prompt || !level || !format || !imageDecision || !scriptAndAudioDecision) {
        renderSceneMediaVariationView(request, response.status(422), resolved, {
            error: response.locals.t('mediaLibrary.invalidRequest'),
            form,
        });
        return;
    }
    const layerDecisions = {
        image: imageDecision,
        scriptAndAudio: scriptAndAudioDecision,
    };
    const generationMode = scriptAndAudioDecision === 'do_not_include' ? 'image_only' : 'complete_scene';
    const generateInput = {
        format,
        generationMode,
        layerDecisions,
        level,
        ownerProfileId: activeProfile.id,
        ownerUserId: user.id,
        prompt,
        scriptTypePreference,
        sourceItem,
    };
    if (wantsProgressStream(request)) {
        await streamSceneMediaGeneration(response, {
            cleanup: (draft) => deleteUnpersistedSceneMediaObjects(draft, sourceItem),
            generateInput,
            logContext: { sourceMediaId: sourceItem.id, userId: user.id },
            logEvent: 'scene_media_variation_failed',
        });
        return;
    }
    try {
        const draft = await generateReadySceneMedia(generateInput);
        let media;
        try {
            media = createReadyUserSceneMedia(draft);
        }
        catch (error) {
            await deleteUnpersistedSceneMediaObjects(draft, sourceItem);
            throw error;
        }
        response.redirect(`/media-library/${encodeURIComponent(media.id)}`);
    }
    catch (error) {
        logger.error('scene_media_variation_failed', {
            error: serializeError(error),
            sourceMediaId: sourceItem.id,
            userId: user.id,
        });
        renderSceneMediaVariationView(request, response.status(422), resolved, {
            creditExhausted: isCreditExhaustedError(error),
            error: sceneMediaCreationFailureMessage(response, error),
            form,
        });
    }
}
export function renderEditSceneMediaPage(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    renderSceneMediaAuthoringView(request, response, resolved, { error: '' });
}
function renderSceneMediaAuthoringView(request, response, resolved, input) {
    response.render('media-library-authoring', {
        ...buildAppShellContext({
            activeProfile: resolved.activeProfile,
            authMessage: getHomeAuthMessage(request, resolved.user),
            currentView: 'mediaLibrary',
            guestInitialGreeting: '',
            request,
            title: buildDocumentTitle(request.locale, resolved.mediaItem.title),
            user: resolved.user,
        }),
        authoringError: input.error,
        mediaItem: resolved.mediaItem,
        sceneMediaLevels,
    });
}
export function saveSceneMediaDetails(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    // The general form edits the title only. Level and script type belong to the
    // script regeneration flow so stored labels cannot drift from the content.
    const title = readField(request.body.title, 120);
    if (!title) {
        renderSceneMediaAuthoringView(request, response.status(422), resolved, {
            error: response.locals.t('mediaLibrary.titleRequired'),
        });
        return;
    }
    updateUserSceneMediaTitle({
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
        title,
    });
    response.redirect(`/media-library/${encodeURIComponent(resolved.mediaItem.id)}/edit`);
}
export async function generateSceneMediaTitle(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    try {
        const result = await generateSceneMediaTitleDraft({
            media: resolved.mediaItem,
            ownerUserId: resolved.user.id,
        });
        response.json({ title: result.title });
    }
    catch (error) {
        logger.error('scene_media_title_generation_failed', {
            error: serializeError(error),
            mediaId: resolved.mediaItem.id,
            userId: resolved.user.id,
        });
        response.status(422).json({
            creditExhausted: isCreditExhaustedError(error),
            error: isCreditExhaustedError(error)
                ? response.locals.t('mediaLibrary.creditExhausted')
                : response.locals.t('mediaLibrary.titleGenerationFailed'),
        });
    }
}
// Generates a not-yet-applied image change and streams progress. The preview is
// stored in the pending-preview store keyed to this media so a later apply can
// commit it; a prior pending preview is superseded and its objects deleted. The
// reference image is the last pending image preview when present, so successive
// tweaks refine each other ("modificaciones puntuales").
export async function previewSceneMediaImage(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const prompt = readField(request.body.prompt, 2000);
    if (!prompt || !resolved.mediaItem.image) {
        response.status(422).json({ error: response.locals.t('mediaLibrary.invalidRequest') });
        return;
    }
    // The author may switch the layout (e.g. four panels -> two); default to the
    // media's current format.
    const format = normalizeSceneMediaFormat(request.body.format) || resolved.mediaItem.format;
    const owner = {
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
    };
    const storage = getUserFileStorageProvider();
    const stream = openSceneMediaProgressStream(response);
    const previewId = randomUUID();
    try {
        const existing = getPendingPreview(owner);
        // Only reference an image that already matches the target layout: the last
        // preview of the same format (iterative tweaks), otherwise the live image
        // when the format is unchanged. A format change regenerates from scratch so
        // the new panel layout is not fought by an old-layout reference.
        let referenceImage;
        if (existing?.type === 'image' && existing.format === format) {
            referenceImage = await readSceneMediaReferenceImage(resolved.mediaItem, existing.image);
        }
        else if (format === resolved.mediaItem.format) {
            referenceImage = await readSceneMediaReferenceImage(resolved.mediaItem);
        }
        const preview = await generateSceneMediaImagePreview({
            format,
            media: resolved.mediaItem,
            onProgress: stream.writeProgress,
            ownerUserId: resolved.user.id,
            previewId,
            prompt,
            referenceImage,
        });
        if (existing) {
            await Promise.allSettled(existing.storageKeys.map((key) => storage.deleteObject(key)));
        }
        setPendingPreview(owner, {
            createdAt: Date.now(),
            format,
            image: preview.image,
            previewId,
            prompt,
            storageKeys: preview.storageKeys,
            type: 'image',
        });
        stream.write({
            imageAlt: preview.image.alt,
            imageSrc: preview.image.src,
            layer: 'image',
            percent: 100,
            previewId,
            type: 'done',
        });
    }
    catch (error) {
        logger.error('scene_media_preview_failed', {
            error: serializeError(error),
            layer: 'image',
            mediaId: resolved.mediaItem.id,
            userId: resolved.user.id,
        });
        stream.write({
            creditExhausted: isCreditExhaustedError(error),
            message: sceneMediaCreationFailureMessage(response, error),
            type: 'error',
        });
    }
    finally {
        response.end();
    }
}
// Generates a not-yet-applied script+audio change and streams progress. Script
// and audio are one atomic layer, so this always regenerates the audio too.
export async function previewSceneMediaScript(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const currentLevel = resolved.mediaItem.level ?? 'A1-A2';
    const storedScriptTypePreference = resolved.mediaItem.scriptTypePreference;
    const currentScriptTypePreference = storedScriptTypePreference &&
        storedScriptTypePreference !== 'unspecified'
        ? storedScriptTypePreference
        : resolved.mediaItem.script?.scriptType ?? 'unspecified';
    const level = normalizeSceneMediaLevel(request.body.level) ?? currentLevel;
    const scriptTypePreference = normalizeOptionalScriptTypePreference(request.body.scriptTypePreference) ?? currentScriptTypePreference;
    const requestedPrompt = readField(request.body.prompt, 2000);
    const parametersChanged = level !== currentLevel ||
        scriptTypePreference !== currentScriptTypePreference;
    if (!requestedPrompt && !parametersChanged) {
        response.status(422).json({ error: response.locals.t('mediaLibrary.invalidRequest') });
        return;
    }
    const prompt = requestedPrompt ||
        'Regenerate the script using the selected learner level and script type.';
    const owner = {
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
    };
    const storage = getUserFileStorageProvider();
    const stream = openSceneMediaProgressStream(response);
    const previewId = randomUUID();
    try {
        const existing = getPendingPreview(owner);
        // Iterative refinement: build on the last script draft when present so
        // "make it shorter" then "add a greeting" chain, mirroring the image flow.
        const baseScript = existing?.type === 'script' ? existing.script : undefined;
        const draft = await generateSceneMediaScriptDraft({
            baseScript,
            level,
            media: resolved.mediaItem,
            onProgress: stream.writeProgress,
            ownerUserId: resolved.user.id,
            prompt,
            scriptTypePreference,
        });
        if (existing) {
            await Promise.allSettled(existing.storageKeys.map((key) => storage.deleteObject(key)));
        }
        setPendingPreview(owner, {
            createdAt: Date.now(),
            level,
            previewId,
            prompt,
            script: draft.script,
            scriptTypePreference,
            storageKeys: [],
            type: 'script',
        });
        stream.write({
            layer: 'script',
            percent: 100,
            previewId,
            script: draft.script,
            type: 'done',
        });
    }
    catch (error) {
        logger.error('scene_media_preview_failed', {
            error: serializeError(error),
            layer: 'script',
            mediaId: resolved.mediaItem.id,
            userId: resolved.user.id,
        });
        stream.write({
            creditExhausted: isCreditExhaustedError(error),
            message: sceneMediaCreationFailureMessage(response, error),
            type: 'error',
        });
    }
    finally {
        response.end();
    }
}
// Regenerates the descriptive metadata bundle (title, setting, visual summary,
// tags, skills, use cases) from the current scene and streams progress. The
// guidance is optional: empty guidance is a pure resync, falling back to the
// media's own generation prompt/title. Stored as a text-only pending preview.
export async function previewSceneMediaMetadata(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const guidance = readField(request.body.prompt, 2000);
    const effectivePrompt = guidance ||
        resolved.mediaItem.generationPrompt ||
        resolved.mediaItem.createdFrom?.prompt ||
        resolved.mediaItem.title;
    const owner = {
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
    };
    const storage = getUserFileStorageProvider();
    const stream = openSceneMediaProgressStream(response);
    const previewId = randomUUID();
    try {
        const existing = getPendingPreview(owner);
        const draft = await generateSceneMediaMetadataDraft({
            media: resolved.mediaItem,
            onProgress: stream.writeProgress,
            ownerUserId: resolved.user.id,
            prompt: effectivePrompt,
        });
        if (existing) {
            await Promise.allSettled(existing.storageKeys.map((key) => storage.deleteObject(key)));
        }
        setPendingPreview(owner, {
            createdAt: Date.now(),
            metadata: draft.metadata,
            previewId,
            prompt: guidance,
            storageKeys: [],
            type: 'metadata',
        });
        stream.write({
            layer: 'metadata',
            metadata: draft.metadata,
            percent: 100,
            previewId,
            type: 'done',
        });
    }
    catch (error) {
        logger.error('scene_media_preview_failed', {
            error: serializeError(error),
            layer: 'metadata',
            mediaId: resolved.mediaItem.id,
            userId: resolved.user.id,
        });
        stream.write({
            creditExhausted: isCreditExhaustedError(error),
            message: sceneMediaCreationFailureMessage(response, error),
            type: 'error',
        });
    }
    finally {
        response.end();
    }
}
// Promotes a pending image or metadata preview to the live media. Both are
// quick JSON commits (no generation): image swaps the image layer and deletes
// the old object; metadata rewrites the descriptive fields. Guarded by
// previewId so a stale modal cannot apply the wrong preview. Script previews use
// the streaming applySceneMediaScript instead, since approving a script
// generates its audio.
export async function applySceneMediaPreview(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const owner = {
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
    };
    const pending = getPendingPreview(owner);
    const previewId = readField(request.body.previewId, 100);
    if (!pending ||
        (pending.type !== 'image' && pending.type !== 'metadata') ||
        (previewId && pending.previewId !== previewId)) {
        response.status(409).json({ error: response.locals.t('mediaLibrary.changeModal.expired') });
        return;
    }
    if (pending.type === 'image') {
        const storage = getUserFileStorageProvider();
        const oldStorageKey = resolved.mediaItem.image?.storageKey;
        applyUserSceneMediaImage({
            format: pending.format,
            image: pending.image,
            mediaId: owner.mediaId,
            ownerProfileId: owner.ownerProfileId,
            ownerUserId: owner.ownerUserId,
        });
        if (oldStorageKey && oldStorageKey !== pending.image.storageKey) {
            await storage.deleteObject(oldStorageKey).catch(() => { });
        }
    }
    else {
        applyUserSceneMediaMetadata({
            mediaId: owner.mediaId,
            metadata: pending.metadata,
            ownerProfileId: owner.ownerProfileId,
            ownerUserId: owner.ownerUserId,
        });
    }
    deletePendingPreview(owner);
    response.json({
        ok: true,
        redirect: `/media-library/${encodeURIComponent(owner.mediaId)}/edit`,
    });
}
// Approves a pending script draft: generates its audio (streaming progress),
// commits the script+audio to the live media, and deletes the superseded audio
// clips. The author never hears an intermediate audio preview — approving the
// script is the commit point.
export async function applySceneMediaScript(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const owner = {
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
    };
    const pending = getPendingPreview(owner);
    const previewId = readField(request.body.previewId, 100);
    if (!pending || pending.type !== 'script' || (previewId && pending.previewId !== previewId)) {
        response.status(409).json({ error: response.locals.t('mediaLibrary.changeModal.expired') });
        return;
    }
    const storage = getUserFileStorageProvider();
    const stream = openSceneMediaProgressStream(response);
    try {
        const generated = await generateAndStoreSceneMediaAudio({
            keySuffix: pending.previewId.slice(0, 8),
            media: resolved.mediaItem,
            onProgress: stream.writeProgress,
            ownerUserId: resolved.user.id,
            script: pending.script,
        });
        const staleKeys = (resolved.mediaItem.audio?.clips ?? [])
            .map((clip) => clip.storageKey)
            .filter((key) => Boolean(key));
        applyUserSceneMediaScript({
            audio: generated.audio,
            level: pending.level,
            mediaId: owner.mediaId,
            ownerProfileId: owner.ownerProfileId,
            ownerUserId: owner.ownerUserId,
            script: pending.script,
            scriptTypePreference: pending.scriptTypePreference,
        });
        await Promise.allSettled(staleKeys.map((key) => storage.deleteObject(key)));
        deletePendingPreview(owner);
        stream.write({
            layer: 'script',
            percent: 100,
            redirect: `/media-library/${encodeURIComponent(owner.mediaId)}/edit`,
            type: 'done',
        });
    }
    catch (error) {
        logger.error('scene_media_preview_failed', {
            error: serializeError(error),
            layer: 'script-apply',
            mediaId: resolved.mediaItem.id,
            userId: resolved.user.id,
        });
        stream.write({
            creditExhausted: isCreditExhaustedError(error),
            message: sceneMediaCreationFailureMessage(response, error),
            type: 'error',
        });
    }
    finally {
        response.end();
    }
}
// Drops the pending preview and deletes its temporary objects. Called when the
// author closes or cancels the change modal without applying.
export async function discardSceneMediaPreview(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const owner = {
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
    };
    const pending = getPendingPreview(owner);
    if (pending) {
        const storage = getUserFileStorageProvider();
        await Promise.allSettled(pending.storageKeys.map((key) => storage.deleteObject(key)));
        deletePendingPreview(owner);
    }
    response.json({ ok: true });
}
export function archiveSceneMedia(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    const archived = archiveUserSceneMediaForProfile({
        mediaId,
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
    });
    if (archived) {
        logger.info('scene_media_archived', {
            mediaId,
            profileId: auth.activeProfile.id,
            userId: auth.user.id,
        });
    }
    response.redirect('/media-library');
}
export function restoreSceneMedia(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return;
    }
    const mediaId = typeof request.params.mediaId === 'string'
        ? request.params.mediaId
        : '';
    const restored = restoreUserSceneMediaForProfile({
        mediaId,
        ownerProfileId: auth.activeProfile.id,
        ownerUserId: auth.user.id,
    });
    if (restored) {
        logger.info('scene_media_restored', {
            mediaId,
            profileId: auth.activeProfile.id,
            userId: auth.user.id,
        });
    }
    response.redirect('/media-library/trash');
}
function defaultNewMediaForm() {
    return {
        format: 'single_panel_scene',
        generationMode: 'image_only',
        level: 'A1-A2',
        prompt: '',
        scriptTypePreference: 'unspecified',
    };
}
function readNewMediaForm(request) {
    const generationMode = normalizeGenerationMode(request.body.generationMode);
    return {
        format: normalizeSceneMediaFormat(request.body.format),
        generationMode,
        level: normalizeSceneMediaLevel(request.body.level),
        prompt: readField(request.body.prompt, 2000),
        scriptTypePreference: generationMode === 'complete_scene'
            ? normalizeScriptTypePreference(request.body.scriptTypePreference)
            : 'unspecified',
    };
}
function defaultVariationForm(sourceItem) {
    return {
        format: sourceItem.format,
        imageDecision: 'keep_existing',
        level: sourceItem.level ?? 'A1-A2',
        prompt: '',
        scriptAndAudioDecision: sourceItem.script && sourceItem.audio
            ? 'keep_existing'
            : 'do_not_include',
        scriptTypePreference: sourceItem.scriptTypePreference ?? 'unspecified',
    };
}
function readVariationForm(request, sourceItem) {
    const imageDecision = normalizeImageDecision(request.body.imageDecision);
    const scriptAndAudioDecision = normalizeScriptAndAudioDecision(request.body.scriptAndAudioDecision, sourceItem);
    return {
        format: imageDecision === 'keep_existing'
            ? sourceItem.format
            : normalizeSceneMediaFormat(request.body.format),
        imageDecision,
        level: normalizeSceneMediaLevel(request.body.level) ?? sourceItem.level,
        prompt: readField(request.body.prompt, 2000),
        scriptAndAudioDecision,
        scriptTypePreference: scriptAndAudioDecision === 'generate_new'
            ? normalizeScriptTypePreference(request.body.scriptTypePreference)
            : 'unspecified',
    };
}
function resolveSceneMedia(request, response) {
    const auth = ensureVerifiedSceneMediaUser(request, response);
    if (!auth) {
        return null;
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
        return null;
    }
    return { ...auth, mediaItem };
}
function resolveOwnedUserSceneMedia(request, response) {
    const resolved = resolveSceneMedia(request, response);
    if (!resolved) {
        return null;
    }
    if (resolved.mediaItem.source !== 'user_generated') {
        response.redirect(`/media-library/${encodeURIComponent(resolved.mediaItem.id)}`);
        return null;
    }
    return resolved;
}
function sceneMediaCreationFailureMessage(response, error) {
    if (isCreditExhaustedError(error)) {
        return response.locals.t('mediaLibrary.creditExhausted');
    }
    if (error instanceof SceneMediaCreationError && error.reason === 'content_policy') {
        return response.locals.t('mediaLibrary.failure.contentPolicy');
    }
    return response.locals.t('mediaLibrary.creationFailed');
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
    return normalizeOptionalScriptTypePreference(value) ?? 'unspecified';
}
function normalizeOptionalScriptTypePreference(value) {
    return value === 'unspecified' ||
        value === 'dialogue' ||
        value === 'narration' ||
        value === 'monologue'
        ? value
        : undefined;
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
function normalizeMediaLibraryReturnTo(value) {
    const returnTo = readField(value, 2000);
    return returnTo === '/media-library' ||
        returnTo.startsWith('/media-library?')
        ? returnTo
        : '/media-library';
}
//# sourceMappingURL=handlers.js.map