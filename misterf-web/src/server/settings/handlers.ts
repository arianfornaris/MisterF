import type { Request, Response } from 'express';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';

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
