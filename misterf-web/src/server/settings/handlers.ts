import type { Request, Response } from 'express';
import {
  updateConversationModelTierForProfile,
  updateProfileModelTierForUser,
} from '../db/repository.js';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';

function normalizeModelTier(
  value: unknown,
): 'advanced' | 'max' | 'regular' {
  if (value === 'max') {
    return 'max';
  }

  if (value === 'advanced') {
    return 'advanced';
  }

  return 'regular';
}

function ensureVerifiedSettingsUser(
  request: Request,
  response: Response,
): NonNullable<Request['authUser']> | null {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return null;
  }

  return user;
}

export function renderSettingsPage(request: Request, response: Response): void {
  const user = ensureVerifiedSettingsUser(request, response);
  if (!user) {
    return;
  }

  response.render('settings', {
    ...buildAppShellContext({
      activeProfile: request.activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'settings',
      guestInitialGreeting: '',
      request,
      title: `Ajustes · ${appDocumentTitle}`,
      user,
    }),
  });
}

export function handleUpdateSettingsPage(request: Request, response: Response): void {
  const user = ensureVerifiedSettingsUser(request, response);
  if (!user) {
    return;
  }

  const activeProfile = request.activeProfile;
  if (!activeProfile) {
    response.redirect('/profiles');
    return;
  }

  const nextModelTier = normalizeModelTier(request.body?.modelTier);

  updateProfileModelTierForUser(activeProfile.id, user.id, nextModelTier);
  updateConversationModelTierForProfile(user.id, activeProfile.id, nextModelTier);

  response.redirect('/settings');
}
