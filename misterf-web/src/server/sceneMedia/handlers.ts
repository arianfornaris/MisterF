import type { Request, Response } from 'express';
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
    sceneMediaLevels,
    selectedFormat,
    selectedLevel,
    searchQuery,
    totalMediaCount: listSceneMediaItems().length,
  });
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
  const mediaItem = findSceneMediaItemById(mediaId);
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
    mediaItem,
    returnTo: normalizeMediaLibraryReturnTo(request.query.returnTo),
  });
}

function readField(value: unknown, maxLength: number): string {
  if (Array.isArray(value)) {
    return readField(value[0], maxLength);
  }

  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizeMediaLibraryReturnTo(value: unknown): string {
  const returnTo = readField(value, 2000);
  return returnTo === '/media-library' ||
    returnTo.startsWith('/media-library?')
    ? returnTo
    : '/media-library';
}
