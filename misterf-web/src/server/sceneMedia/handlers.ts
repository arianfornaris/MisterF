import type { Request, Response } from 'express';
import {
  getCreditCheckedOpenRouterApiKeyForUser,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';
import {
  findSceneMediaItemById,
  listSceneMediaItems,
  normalizeSceneMediaFormat,
  normalizeSceneMediaLevel,
  sceneMediaFormats,
  sceneMediaLevels,
} from './library.js';
import type {
  SceneMediaAuthoringMessage,
  SceneMediaLibraryItem,
  UserSceneMediaGenerationMode,
  UserSceneMediaLayerDecisions,
  UserSceneMediaScriptTypePreference,
} from './types.js';
import {
  archiveUserSceneMediaForProfile,
  createReadyUserSceneMedia,
  updateReadyUserSceneMedia,
  updateUserSceneMediaAuthoringMessages,
  updateUserSceneMediaTitle,
  type CreateReadyUserSceneMediaInput,
} from './userMediaRepository.js';
import type { Translator } from '../i18n/index.js';
import { getUserFileStorageProvider } from '../storage/userFileStorage.js';
import {
  createAuthoringSnapshot,
  deleteUnpersistedSceneMediaObjects,
  generateReadySceneMedia,
  SceneMediaCreationError,
  type GenerateReadySceneMediaInput,
  type SceneMediaGenerationProgress,
} from './creation.js';
import { readSceneMediaImageAsset } from './imageAssets.js';
import { generateSceneMediaRevisionPlan } from '../services/sceneMediaRevisions.js';
import { logger, serializeError } from '../services/logger.js';

type SceneMediaRequestUser = {
  activeProfile: NonNullable<Request['activeProfile']>;
  user: NonNullable<Request['authUser']>;
};

function ensureVerifiedSceneMediaUser(
  request: Request,
  response: Response,
): SceneMediaRequestUser | null {
  const user = request.authUser;
  const activeProfile = request.activeProfile;

  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return null;
  }

  return { activeProfile, user };
}

export function renderSceneMediaLibraryPage(
  request: Request,
  response: Response,
): void {
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
    mediaPreviewItemsJson: serializeViewJson(
      mediaItems.map(toSceneMediaPreviewItem),
    ),
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

export function renderNewSceneMediaPage(request: Request, response: Response): void {
  const auth = ensureVerifiedSceneMediaUser(request, response);
  if (!auth) {
    return;
  }
  renderSceneMediaNewView(request, response, auth, {
    error: '',
    form: defaultNewMediaForm(),
  });
}

function renderSceneMediaNewView(
  request: Request,
  response: Response,
  auth: SceneMediaRequestUser,
  input: {
    creditExhausted?: boolean;
    error: string;
    form: SceneMediaCreationForm;
  },
): void {
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

export function renderNewSceneMediaVariationPage(
  request: Request,
  response: Response,
): void {
  const resolved = resolveSceneMedia(request, response);
  if (!resolved) {
    return;
  }
  renderSceneMediaVariationView(request, response, resolved, {
    error: '',
    form: defaultVariationForm(resolved.mediaItem),
  });
}

function renderSceneMediaVariationView(
  request: Request,
  response: Response,
  resolved: SceneMediaRequestUser & { mediaItem: SceneMediaLibraryItem },
  input: {
    creditExhausted?: boolean;
    error: string;
    form: SceneMediaVariationForm;
  },
): void {
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

function toSceneMediaPreviewItem(item: SceneMediaLibraryItem): Pick<
  SceneMediaLibraryItem,
  'audio' | 'id' | 'image' | 'script' | 'title'
> {
  return {
    audio: item.audio,
    id: item.id,
    image: item.image,
    script: item.script,
    title: item.title,
  };
}

function serializeViewJson(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(
    /[<>&\u2028\u2029]/g,
    (character) => {
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
    },
  );
}

export function renderSceneMediaDetailPage(
  request: Request,
  response: Response,
): void {
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

export async function serveSceneMediaImageAsset(
  request: Request,
  response: Response,
): Promise<void> {
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

function wantsProgressStream(request: Request): boolean {
  return Boolean(request.get('accept')?.includes('application/x-ndjson'));
}

function sceneMediaProgressPercent(progress: SceneMediaGenerationProgress): number {
  switch (progress.stage) {
    case 'image':
      return progress.completed >= progress.total ? 40 : 12;
    case 'metadata':
      return progress.completed >= progress.total ? 58 : 46;
    case 'audio': {
      const ratio = progress.total > 0 ? progress.completed / progress.total : 0;
      return Math.min(92, 60 + Math.round(ratio * 32));
    }
    case 'saving':
      return 96;
  }
}

function sceneMediaProgressMessage(
  t: Translator,
  progress: SceneMediaGenerationProgress,
): string {
  switch (progress.stage) {
    case 'image':
      return t('mediaLibrary.progress.image');
    case 'metadata':
      return t('mediaLibrary.progress.metadata');
    case 'audio':
      return t('mediaLibrary.progress.audio', {
        completed: progress.completed,
        total: progress.total,
      });
    case 'saving':
      return t('mediaLibrary.progress.saving');
  }
}

// Runs the (long) generation while streaming newline-delimited JSON progress
// events to the client instead of blocking on a single redirect. Emits
// `progress` events per stage, then a final `done` (with the redirect target)
// or `error` event. Errors are reported in-band so the already-flushed stream
// can surface them; the HTTP status stays 200.
async function streamSceneMediaGeneration(
  response: Response,
  options: {
    cleanup: (draft: CreateReadyUserSceneMediaInput) => Promise<void>;
    generateInput: GenerateReadySceneMediaInput;
    logContext: Record<string, unknown>;
    logEvent: string;
  },
): Promise<void> {
  const t = response.locals.t;
  response.status(200);
  response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();

  const write = (payload: Record<string, unknown>): void => {
    response.write(`${JSON.stringify(payload)}\n`);
  };
  const savingProgress: SceneMediaGenerationProgress = {
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
    let media: SceneMediaLibraryItem;
    try {
      media = createReadyUserSceneMedia(draft);
    } catch (error) {
      await options.cleanup(draft);
      throw error;
    }
    write({
      percent: 100,
      redirect: `/media-library/${encodeURIComponent(media.id)}`,
      type: 'done',
    });
  } catch (error) {
    logger.error(options.logEvent, {
      error: serializeError(error),
      ...options.logContext,
    });
    write({
      creditExhausted: isCreditExhaustedError(error),
      message: sceneMediaCreationFailureMessage(response, error),
      type: 'error',
    });
  } finally {
    response.end();
  }
}

export async function createSceneMediaFromPrompt(
  request: Request,
  response: Response,
): Promise<void> {
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

  const generateInput: GenerateReadySceneMediaInput = {
    createdAssistantMessage: response.locals.t('mediaLibrary.createdChatMessage'),
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
    let media: SceneMediaLibraryItem;
    try {
      media = createReadyUserSceneMedia(draft);
    } catch (error) {
      await deleteUnpersistedSceneMediaObjects(draft);
      throw error;
    }
    response.redirect(`/media-library/${encodeURIComponent(media.id)}`);
  } catch (error) {
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

export async function createSceneMediaVariation(
  request: Request,
  response: Response,
): Promise<void> {
  const resolved = resolveSceneMedia(request, response);
  if (!resolved) {
    return;
  }
  const { activeProfile, mediaItem: sourceItem, user } = resolved;

  const form = readVariationForm(request, sourceItem);
  const {
    format,
    imageDecision,
    level,
    prompt,
    scriptAndAudioDecision,
    scriptTypePreference,
  } = form;

  if (!prompt || !level || !format || !imageDecision || !scriptAndAudioDecision) {
    renderSceneMediaVariationView(request, response.status(422), resolved, {
      error: response.locals.t('mediaLibrary.invalidRequest'),
      form,
    });
    return;
  }

  const layerDecisions: UserSceneMediaLayerDecisions = {
    image: imageDecision,
    scriptAndAudio: scriptAndAudioDecision,
  };
  const generationMode: UserSceneMediaGenerationMode =
    scriptAndAudioDecision === 'do_not_include' ? 'image_only' : 'complete_scene';
  const generateInput: GenerateReadySceneMediaInput = {
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
    let media: SceneMediaLibraryItem;
    try {
      media = createReadyUserSceneMedia(draft);
    } catch (error) {
      await deleteUnpersistedSceneMediaObjects(draft, sourceItem);
      throw error;
    }
    response.redirect(`/media-library/${encodeURIComponent(media.id)}`);
  } catch (error) {
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

export function renderEditSceneMediaPage(request: Request, response: Response): void {
  const resolved = resolveOwnedUserSceneMedia(request, response);
  if (!resolved) {
    return;
  }
  renderSceneMediaAuthoringView(request, response, resolved, {
    activeTab: request.query.tab === 'chat' ? 'chat' : 'general',
    error: '',
  });
}

function renderSceneMediaAuthoringView(
  request: Request,
  response: Response,
  resolved: SceneMediaRequestUser & { mediaItem: SceneMediaLibraryItem },
  input: { activeTab: 'chat' | 'general'; error: string },
): void {
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

export function saveSceneMediaTitle(request: Request, response: Response): void {
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

export async function reviseSceneMedia(
  request: Request,
  response: Response,
): Promise<void> {
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
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(
      resolved.user.id,
    );
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
    const layerDecisions: UserSceneMediaLayerDecisions = {
      image: plan.imageDecision,
      scriptAndAudio: plan.scriptAndAudioDecision,
    };
    const generationMode: UserSceneMediaGenerationMode =
      plan.scriptAndAudioDecision === 'do_not_include'
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
    const authoringMessages = appendSceneMediaAuthoringMessages(
      resolved.mediaItem.authoringMessages ?? [],
      createSceneMediaAuthoringMessage('user', message),
      createSceneMediaAuthoringMessage('assistant', plan.assistantMessage, snapshot),
    );
    const { createdFrom: _createdFrom, id: _id, ...updatedDraft } = draft;
    let updated: SceneMediaLibraryItem | null;
    try {
      updated = updateReadyUserSceneMedia({
        ...updatedDraft,
        authoringMessages,
        mediaId: resolved.mediaItem.id,
        ownerProfileId: resolved.activeProfile.id,
        ownerUserId: resolved.user.id,
      });
    } catch (error) {
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
  } catch (error) {
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

function respondToRevisionFailure(
  request: Request,
  response: Response,
  resolved: SceneMediaRequestUser & { mediaItem: SceneMediaLibraryItem },
  input: { creditExhausted: boolean; message: string; userMessage: string },
): void {
  const messages = appendSceneMediaAuthoringMessages(
    resolved.mediaItem.authoringMessages ?? [],
    createSceneMediaAuthoringMessage('user', input.userMessage),
    createSceneMediaAuthoringMessage('assistant', input.message),
  );
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

export function archiveSceneMedia(
  request: Request,
  response: Response,
): void {
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

type SceneMediaCreationForm = {
  format: ReturnType<typeof normalizeSceneMediaFormat>;
  generationMode: UserSceneMediaGenerationMode | null;
  level: ReturnType<typeof normalizeSceneMediaLevel>;
  prompt: string;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
};

type SceneMediaVariationForm = {
  format: ReturnType<typeof normalizeSceneMediaFormat>;
  imageDecision: UserSceneMediaLayerDecisions['image'] | null;
  level: ReturnType<typeof normalizeSceneMediaLevel>;
  prompt: string;
  scriptAndAudioDecision: UserSceneMediaLayerDecisions['scriptAndAudio'] | null;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
};

function defaultNewMediaForm(): SceneMediaCreationForm {
  return {
    format: 'single_panel_scene',
    generationMode: 'image_only',
    level: 'A1-A2',
    prompt: '',
    scriptTypePreference: 'unspecified',
  };
}

function readNewMediaForm(request: Request): SceneMediaCreationForm {
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

function defaultVariationForm(
  sourceItem: SceneMediaLibraryItem,
): SceneMediaVariationForm {
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

function readVariationForm(
  request: Request,
  sourceItem: SceneMediaLibraryItem,
): SceneMediaVariationForm {
  const imageDecision = normalizeImageDecision(request.body.imageDecision);
  const scriptAndAudioDecision = normalizeScriptAndAudioDecision(
    request.body.scriptAndAudioDecision,
    sourceItem,
  );
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

function resolveSceneMedia(
  request: Request,
  response: Response,
): (SceneMediaRequestUser & { mediaItem: SceneMediaLibraryItem }) | null {
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

function resolveOwnedUserSceneMedia(
  request: Request,
  response: Response,
): (SceneMediaRequestUser & { mediaItem: SceneMediaLibraryItem }) | null {
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

function createSceneMediaAuthoringMessage(
  role: SceneMediaAuthoringMessage['role'],
  content: string,
  draftSnapshot?: Record<string, unknown>,
): SceneMediaAuthoringMessage {
  return {
    content: content.trim().slice(0, 6000),
    createdAt: new Date().toISOString(),
    draftSnapshot,
    role,
  };
}

function appendSceneMediaAuthoringMessages(
  existing: SceneMediaAuthoringMessage[],
  ...messages: SceneMediaAuthoringMessage[]
): SceneMediaAuthoringMessage[] {
  return [...existing, ...messages]
    .filter((message) => message.content.trim())
    .slice(-40);
}

function sceneMediaCreationFailureMessage(response: Response, error: unknown): string {
  if (isCreditExhaustedError(error)) {
    return response.locals.t('mediaLibrary.creditExhausted');
  }
  if (error instanceof SceneMediaCreationError && error.reason === 'content_policy') {
    return response.locals.t('mediaLibrary.failure.contentPolicy');
  }
  return response.locals.t('mediaLibrary.creationFailed');
}

function sceneMediaRevisionFailureMessage(response: Response, error: unknown): string {
  if (error instanceof SceneMediaCreationError && error.reason === 'audio_provider_error') {
    return response.locals.t('mediaLibrary.revisionAudioFailed');
  }
  return response.locals.t('mediaLibrary.revisionFailed');
}

function wantsJsonResponse(request: Request): boolean {
  return Boolean(request.get('accept')?.includes('application/json'));
}

function readField(value: unknown, maxLength: number): string {
  if (Array.isArray(value)) {
    return readField(value[0], maxLength);
  }

  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizeGenerationMode(value: unknown): UserSceneMediaGenerationMode | null {
  return value === 'image_only' || value === 'complete_scene' ? value : null;
}

function normalizeScriptTypePreference(
  value: unknown,
): UserSceneMediaScriptTypePreference {
  return value === 'dialogue' ||
    value === 'narration' ||
    value === 'monologue'
    ? value
    : 'unspecified';
}

function normalizeImageDecision(
  value: unknown,
): UserSceneMediaLayerDecisions['image'] | null {
  return value === 'keep_existing' || value === 'generate_new' ? value : null;
}

function normalizeScriptAndAudioDecision(
  value: unknown,
  sourceItem: SceneMediaLibraryItem,
): UserSceneMediaLayerDecisions['scriptAndAudio'] | null {
  if (value === 'keep_existing') {
    return sourceItem.script && sourceItem.audio ? value : null;
  }
  return value === 'generate_new' || value === 'do_not_include' ? value : null;
}

function normalizeMediaLibraryReturnTo(value: unknown): string {
  const returnTo = readField(value, 2000);
  return returnTo === '/media-library' ||
    returnTo.startsWith('/media-library?')
    ? returnTo
    : '/media-library';
}
