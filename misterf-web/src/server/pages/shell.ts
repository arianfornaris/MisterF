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

export const appDocumentTitle = 'Mr. F, tutor de inglés';

const spanishRelativeTimeFormatter = new Intl.RelativeTimeFormat('es', {
  numeric: 'always',
});

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAppTimestamp(value: string): number {
  const trimmed = value.trim();
  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
  ) {
    return Date.parse(`${trimmed.replace(' ', 'T')}Z`);
  }

  return Date.parse(trimmed);
}

export function formatRelativeTime(value: string): string {
  const timestamp = parseAppTimestamp(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = timestamp - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return spanishRelativeTimeFormatter.format(diffSeconds, 'second');
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 60) {
    return spanishRelativeTimeFormatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return spanishRelativeTimeFormatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return spanishRelativeTimeFormatter.format(diffDays, 'day');
  }

  const diffWeeks = Math.round(diffDays / 7);
  const absWeeks = Math.abs(diffWeeks);
  if (absWeeks < 5) {
    return spanishRelativeTimeFormatter.format(diffWeeks, 'week');
  }

  const diffMonths = Math.round(diffDays / 30);
  const absMonths = Math.abs(diffMonths);
  if (absMonths < 12) {
    return spanishRelativeTimeFormatter.format(diffMonths, 'month');
  }

  const diffYears = Math.round(diffDays / 365);
  return spanishRelativeTimeFormatter.format(diffYears, 'year');
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
      `Antes de practicar, verifica tu correo: **${user.email}**.`,
      '[Escribir código de verificación](/verify-needed).',
    ].join('\n\n');
  }

  return '';
}

export function resolveGuestInitialGreeting(request: Request, user: AuthUser | null): string {
  if (user) {
    return '';
  }

  return hasKnownVisitorCookie(request)
    ? pickKnownVisitorGreeting()
    : pickInitialGreeting();
}

export function buildAppShellContext(input: {
  activeProfile: StoredProfile | null;
  authMessage: string;
  currentView:
    | 'quizzes'
    | 'chat'
    | 'credits'
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
    activeProfileModelTier: input.activeProfile?.modelTier ?? 'regular',
    authMessage: input.authMessage,
    chatMode: 'tutor',
    conversations:
      input.user && input.activeProfile
        ? listConversationsForProfile(input.user.id, input.activeProfile.id).map(
            (conversation) => ({
              ...conversation,
              relativeUpdatedAt: formatRelativeTime(conversation.updatedAt),
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
