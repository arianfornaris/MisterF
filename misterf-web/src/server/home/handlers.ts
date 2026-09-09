import type { Request, Response } from 'express';
import { renderChatPage } from '../chat/handlers.js';
import { updateProfileHomeMode } from '../db/repository.js';
import { translate } from '../i18n/index.js';
import {
  buildAppShellContext,
  buildDocumentTitle,
  getHomeAuthMessage,
} from '../pages/shell.js';
import { normalizeProfileHomeMode } from '../profiles/homeMode.js';
import { normalizeProfileReturnTo } from '../profiles/fields.js';
import { buildTeachingHomeData } from './data.js';

/**
 * `/` is one route with two compositions (Roadmap V3 §1.14). The profile's
 * home mode decides which one opens; it decides nothing else, so a profile that
 * teaches still reaches the tutor through `/chat` and every other surface
 * unchanged.
 *
 * Visitors never arrive here — `landingRouter` renders the public landing for a
 * request without a session and passes authenticated ones through — but an
 * unverified account can, and it belongs in the chat composition with the
 * verification notice the chat page already renders.
 */
export function renderHomePage(request: Request, response: Response): void {
  const user = request.authUser;
  const activeProfile = request.activeProfile;

  if (!user?.emailVerified || !activeProfile) {
    renderChatPage(request, response);
    return;
  }

  if (activeProfile.homeMode === 'teach') {
    renderTeachingHomePage(request, response);
    return;
  }

  renderChatPage(request, response);
}

function renderTeachingHomePage(request: Request, response: Response): void {
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user || !activeProfile) {
    response.redirect('/login');
    return;
  }

  response.render('home-teaching', {
    ...buildAppShellContext({
      activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'chat',
      guestInitialGreeting: '',
      request,
      title: buildDocumentTitle(request.locale, translate(request.locale, 'home.teachTitle')),
      user,
    }),
    teachingHome: buildTeachingHomeData({
      profileId: activeProfile.id,
      userId: user.id,
    }),
  });
}

/**
 * The mode switch writes the profile's stored preference rather than a separate
 * session override. One value, one source of truth: switching is a single click
 * from either home, it survives the next visit, and the profile form and the
 * switch can never disagree about which mode the profile is in.
 */
export function handleSwitchHomeMode(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const activeProfile = request.activeProfile;
  const returnTo = normalizeProfileReturnTo(request.body.returnTo);
  if (!activeProfile) {
    response.redirect(returnTo);
    return;
  }

  updateProfileHomeMode({
    homeMode: normalizeProfileHomeMode(request.body.homeMode),
    profileId: activeProfile.id,
    userId: user.id,
  });

  response.redirect(returnTo);
}
