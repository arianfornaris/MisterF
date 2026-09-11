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
import { buildLearningHomeData, buildTeachingHomeData } from './data.js';

/**
 * `/` is one route with two compositions (Roadmap V3 §1.14). The profile's
 * home mode decides which one opens; it decides nothing else. Neither
 * composition is the tutor chat any more (§1.16): a conversation always lives
 * at `/chat` or `/c/:id`, so "go home" and "start a new conversation" are two
 * different links (§1.15).
 *
 * Visitors never arrive here — `landingRouter` renders the public landing for a
 * request without a session and passes authenticated ones through. An
 * unverified account or a session without a profile still falls through to the
 * chat handler, which owns the verification redirect and the profile-less shell.
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

  renderLearningHomePage(request, response);
}

function renderLearningHomePage(request: Request, response: Response): void {
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const shellContext = buildAppShellContext({
    activeProfile,
    authMessage: getHomeAuthMessage(request, user),
    currentView: 'home',
    guestInitialGreeting: '',
    request,
    title: buildDocumentTitle(request.locale, translate(request.locale, 'nav.home')),
    user,
  });

  response.render('home-learning', {
    ...shellContext,
    learningHome: buildLearningHomeData({
      // The shell already lists this profile's conversations for the side
      // panel; "continue where you left off" reads the same rows rather than
      // querying them twice.
      conversations: shellContext.conversations,
      locale: request.locale,
      profileId: activeProfile.id,
      userId: user.id,
    }),
    pageScriptPartial: 'home-client-script',
  });
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
      currentView: 'home',
      guestInitialGreeting: '',
      request,
      title: buildDocumentTitle(request.locale, translate(request.locale, 'home.teachTitle')),
      user,
    }),
    teachingHome: buildTeachingHomeData({
      locale: request.locale,
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
