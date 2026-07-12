import { getCreditCheckedOpenRouterApiKeyForUser, isCreditExhaustedError, } from '../services/creditGate.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
import { findSceneMediaItemById, listSceneMediaItems, normalizeSceneMediaFormat, normalizeSceneMediaLevel, sceneMediaFormats, sceneMediaLevels, } from './library.js';
import { archiveUserSceneMediaForProfile, createReadyUserSceneMedia, updateReadyUserSceneMedia, updateUserSceneMediaAuthoringMessages, updateUserSceneMediaTitle, } from './userMediaRepository.js';
import { getUserFileStorageProvider } from '../storage/userFileStorage.js';
import { createAuthoringSnapshot, deleteUnpersistedSceneMediaObjects, generateReadySceneMedia, SceneMediaCreationError, } from './creation.js';
import { readSceneMediaImageAsset } from './imageAssets.js';
import { generateSceneMediaRevisionPlan } from '../services/sceneMediaRevisions.js';
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
            title: `${response.locals.t('mediaLibrary.title')} · ${appDocumentTitle}`,
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
            title: `${response.locals.t('mediaLibrary.createMedia')} · ${appDocumentTitle}`,
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
            title: `${response.locals.t('mediaLibrary.createVariation')} · ${appDocumentTitle}`,
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
            title: `${mediaItem.title} · ${appDocumentTitle}`,
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
    try {
        const draft = await generateReadySceneMedia({
            createdAssistantMessage: response.locals.t('mediaLibrary.createdChatMessage'),
            format,
            generationMode,
            level,
            ownerProfileId: auth.activeProfile.id,
            ownerUserId: auth.user.id,
            prompt,
            scriptTypePreference,
        });
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
    try {
        const draft = await generateReadySceneMedia({
            createdAssistantMessage: response.locals.t('mediaLibrary.variationCreatedChatMessage'),
            format,
            generationMode,
            layerDecisions,
            level,
            ownerProfileId: activeProfile.id,
            ownerUserId: user.id,
            prompt,
            scriptTypePreference,
            sourceItem,
        });
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
    renderSceneMediaAuthoringView(request, response, resolved, {
        activeTab: request.query.tab === 'chat' ? 'chat' : 'general',
        error: '',
    });
}
function renderSceneMediaAuthoringView(request, response, resolved, input) {
    response.render('media-library-authoring', {
        ...buildAppShellContext({
            activeProfile: resolved.activeProfile,
            authMessage: getHomeAuthMessage(request, resolved.user),
            currentView: 'mediaLibrary',
            guestInitialGreeting: '',
            request,
            title: `${resolved.mediaItem.title} · ${appDocumentTitle}`,
            user: resolved.user,
        }),
        activeTab: input.activeTab,
        authoringError: input.error,
        mediaAuthoringMessages: resolved.mediaItem.authoringMessages ?? [],
        mediaItem: resolved.mediaItem,
    });
}
export function saveSceneMediaTitle(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const title = readField(request.body.title, 120);
    if (!title) {
        renderSceneMediaAuthoringView(request, response.status(422), resolved, {
            activeTab: 'general',
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
    response.redirect(`/media-library/${encodeURIComponent(resolved.mediaItem.id)}/edit?tab=general`);
}
export async function reviseSceneMedia(request, response) {
    const resolved = resolveOwnedUserSceneMedia(request, response);
    if (!resolved) {
        return;
    }
    const message = readField(request.body.message, 4000);
    if (message.length < 3) {
        respondToRevisionFailure(request, response, resolved, {
            creditExhausted: false,
            message: response.locals.t('mediaLibrary.writeChange'),
            userMessage: message,
        });
        return;
    }
    try {
        const imageAsset = await readSceneMediaImageAsset(resolved.mediaItem);
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        if (!openRouterApiKey) {
            throw new SceneMediaCreationError('Missing user OpenRouter API key.');
        }
        const plan = await generateSceneMediaRevisionPlan({
            conversationHistory: resolved.mediaItem.authoringMessages ?? [],
            currentMedia: resolved.mediaItem,
            imageBytes: imageAsset.bytes,
            imageContentType: imageAsset.contentType,
            instructionLanguage: resolved.activeProfile.instructionLanguage,
            openRouterApiKey,
            prompt: message,
        });
        const layerDecisions = {
            image: plan.imageDecision,
            scriptAndAudio: plan.scriptAndAudioDecision,
        };
        const generationMode = plan.scriptAndAudioDecision === 'do_not_include'
            ? 'image_only'
            : 'complete_scene';
        const draft = await generateReadySceneMedia({
            format: plan.format,
            generationMode,
            layerDecisions,
            level: plan.level,
            mediaId: resolved.mediaItem.id,
            ownerProfileId: resolved.activeProfile.id,
            ownerUserId: resolved.user.id,
            prompt: plan.effectivePrompt,
            scriptTypePreference: plan.scriptTypePreference,
            sourceItem: resolved.mediaItem,
        });
        const snapshot = createAuthoringSnapshot(draft);
        const authoringMessages = appendSceneMediaAuthoringMessages(resolved.mediaItem.authoringMessages ?? [], createSceneMediaAuthoringMessage('user', message), createSceneMediaAuthoringMessage('assistant', plan.assistantMessage, snapshot));
        const { createdFrom: _createdFrom, id: _id, ...updatedDraft } = draft;
        let updated;
        try {
            updated = updateReadyUserSceneMedia({
                ...updatedDraft,
                authoringMessages,
                mediaId: resolved.mediaItem.id,
                ownerProfileId: resolved.activeProfile.id,
                ownerUserId: resolved.user.id,
            });
        }
        catch (error) {
            await deleteUnpersistedSceneMediaObjects(draft, resolved.mediaItem);
            throw error;
        }
        if (!updated) {
            await deleteUnpersistedSceneMediaObjects(draft, resolved.mediaItem);
            throw new Error('Unable to save the revised media.');
        }
        if (wantsJsonResponse(request)) {
            response.json({ assistantMessage: plan.assistantMessage });
            return;
        }
        response.redirect(`/media-library/${encodeURIComponent(updated.id)}/edit?tab=chat`);
    }
    catch (error) {
        logger.error('scene_media_revision_failed', {
            error: serializeError(error),
            mediaId: resolved.mediaItem.id,
            userId: resolved.user.id,
        });
        respondToRevisionFailure(request, response, resolved, {
            creditExhausted: isCreditExhaustedError(error),
            message: isCreditExhaustedError(error)
                ? response.locals.t('mediaLibrary.creditExhausted')
                : sceneMediaRevisionFailureMessage(response, error),
            userMessage: message,
        });
    }
}
function respondToRevisionFailure(request, response, resolved, input) {
    const messages = appendSceneMediaAuthoringMessages(resolved.mediaItem.authoringMessages ?? [], createSceneMediaAuthoringMessage('user', input.userMessage), createSceneMediaAuthoringMessage('assistant', input.message));
    const mediaItem = updateUserSceneMediaAuthoringMessages({
        mediaId: resolved.mediaItem.id,
        messages,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
    }) ?? { ...resolved.mediaItem, authoringMessages: messages };
    if (wantsJsonResponse(request)) {
        response.status(422).json({
            creditExhausted: input.creditExhausted,
            error: input.message,
        });
        return;
    }
    renderSceneMediaAuthoringView(request, response.status(422), {
        ...resolved,
        mediaItem,
    }, {
        activeTab: 'chat',
        error: input.message,
    });
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
function createSceneMediaAuthoringMessage(role, content, draftSnapshot) {
    return {
        content: content.trim().slice(0, 6000),
        createdAt: new Date().toISOString(),
        draftSnapshot,
        role,
    };
}
function appendSceneMediaAuthoringMessages(existing, ...messages) {
    return [...existing, ...messages]
        .filter((message) => message.content.trim())
        .slice(-40);
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
function sceneMediaRevisionFailureMessage(response, error) {
    if (error instanceof SceneMediaCreationError && error.reason === 'audio_provider_error') {
        return response.locals.t('mediaLibrary.revisionAudioFailed');
    }
    return response.locals.t('mediaLibrary.revisionFailed');
}
function wantsJsonResponse(request) {
    return Boolean(request.get('accept')?.includes('application/json'));
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
function normalizeMediaLibraryReturnTo(value) {
    const returnTo = readField(value, 2000);
    return returnTo === '/media-library' ||
        returnTo.startsWith('/media-library?')
        ? returnTo
        : '/media-library';
}
//# sourceMappingURL=handlers.js.map