import type { Request, Response } from 'express';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';
import { updateProfileInstructionLanguageForUser } from '../db/repository.js';
import { normalizeInstructionLanguage } from '../profiles/instructionLanguage.js';

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
      title: `${request.res?.locals.t('settings.title')} · ${appDocumentTitle}`,
      user,
    }),
  });
}

export function handleUpdateSettingsLanguage(
  request: Request,
  response: Response,
): void {
  const user = ensureVerifiedSettingsUser(request, response);
  if (!user) {
    return;
  }

  const activeProfile = request.activeProfile;
  if (!activeProfile) {
    response.redirect('/settings');
    return;
  }

  const instructionLanguage = normalizeInstructionLanguage(
    request.body.instructionLanguage,
    activeProfile.instructionLanguage,
  );

  updateProfileInstructionLanguageForUser(
    activeProfile.id,
    user.id,
    instructionLanguage,
  );

  response.redirect('/settings');
}
