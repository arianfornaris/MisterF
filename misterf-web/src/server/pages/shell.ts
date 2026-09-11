import type { Request } from 'express';
import { createSocketAuthToken } from '../auth/socketAuth.js';
import { hasKnownVisitorCookie } from '../auth/session.js';
import type { AuthUser } from '../auth/repository.js';
import {
  pickInitialGreeting,
  pickKnownVisitorGreeting,
} from '../socket/initialGreetings.js';
import {
  listConversationsForProfile,
  type StoredProfile,
} from '../db/repository.js';
import { env } from '../config/env.js';
import { defaultProfileModelTier } from '../profiles/modelTier.js';
import { translate, type Locale } from '../i18n/index.js';
import { formatRelativeTime } from '../i18n/dates.js';

/**
 * The application name as it appears in the browser tab and, through
 * `og:title`, in every link preview the product produces.
 *
 * It was a hardcoded Spanish constant until 2026-08-01, so the English and
 * Haitian Creole landing editions shared as "Mister F · Mr. F, tutor de
 * inglés" — a page whose pitch is that it speaks the teacher's language,
 * saying otherwise in the first line of its own preview card.
 *
 * Takes an explicit locale rather than the request: the landing's language
 * editions force a locale that is deliberately not `request.locale`.
 */
function appDocumentTitle(locale: Locale): string {
  return translate(locale, 'common.appDocumentTitle');
}

/**
 * Builds a page `<title>`: the page's own name, then the application name.
 * Call sites used to interpolate the constant themselves, with `·` in some
 * files and `-` in others; the separator now lives here so it stays uniform.
 */
export function buildDocumentTitle(locale: Locale, pageTitle?: string): string {
  const appTitle = appDocumentTitle(locale);
  const trimmed = pageTitle?.trim();
  return trimmed ? `${trimmed} · ${appTitle}` : appTitle;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildAbsoluteAppUrl(pathname: string): string {
  return new URL(pathname, env.appBaseUrl).toString();
}

export function getHomeAuthMessage(request: Request, user: AuthUser | null): string {
  if (typeof request.query.auth_error === 'string') {
    return request.query.auth_error;
  }

  if (user && !user.emailVerified) {
    return [
      translate(request.locale, 'home.verifyEmailNotice', { email: user.email }),
      translate(request.locale, 'home.verifyEmailLink'),
    ].join('\n\n');
  }

  return '';
}

export function resolveGuestInitialGreeting(request: Request, user: AuthUser | null): string {
  if (user) {
    return '';
  }

  return hasKnownVisitorCookie(request)
    ? pickKnownVisitorGreeting(request.locale)
    : pickInitialGreeting(request.locale);
}

export function buildAppShellContext(input: {
  activeProfile: StoredProfile | null;
  authMessage: string;
  currentView:
    | 'quizzes'
    | 'chat'
    | 'credits'
    | 'home'
    | 'mediaLibrary'
    | 'practiceGuides'
    | 'progress'
    | 'profiles'
    | 'resources'
    | 'settings';
  guestInitialGreeting: string;
  initialConversationId?: string;
  request: Request;
  title: string;
  user: AuthUser | null;
}) {
  const isAuthenticated = Boolean(input.user?.emailVerified);
  const socketAuthToken =
    input.user && isAuthenticated ? createSocketAuthToken(input.user) : '';

  return {
    activeProfile: input.activeProfile,
    activeProfileModelTier:
      input.activeProfile?.modelTier ?? defaultProfileModelTier,
    authMessage: input.authMessage,
    chatMode: 'tutor',
    conversations:
      input.user && input.activeProfile
        ? listConversationsForProfile(input.user.id, input.activeProfile.id).map(
            (conversation) => ({
              ...conversation,
              relativeUpdatedAt: formatRelativeTime(
                conversation.updatedAt,
                input.request.locale,
              ),
            }),
          )
        : [],
    currentPath: input.request.originalUrl || input.request.path,
    currentView: input.currentView,
    csrfToken: input.request.res?.locals.csrfToken ?? '',
    guestInitialGreeting: input.guestInitialGreeting,
    hasSession: Boolean(input.user),
    initialConversationId: input.initialConversationId || '',
    isAuthenticated,
    profiles: input.request.availableProfiles ?? [],
    socketAuthToken,
    title: input.title,
    user: input.user,
  };
}
