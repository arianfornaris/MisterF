import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  defaultLocale,
  isLocale,
  supportedLocales,
  type Locale,
} from './index.js';

export const languageCookieName = 'misterf_lang';

export function getLocaleCookie(request: Request): Locale | null {
  const raw = readCookie(request.headers.cookie, languageCookieName);
  return isLocale(raw) ? raw : null;
}

export function setLocaleCookie(response: Response, locale: Locale): void {
  response.cookie(languageCookieName, locale, {
    httpOnly: false,
    maxAge: 1000 * 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure: env.appBaseUrl.startsWith('https://'),
  });
}

export function negotiateAcceptLanguage(request: Request): Locale | null {
  const negotiated = request.acceptsLanguages(...supportedLocales);
  return isLocale(negotiated) ? negotiated : null;
}

/**
 * Language a visitor sees before any account exists: explicit switcher cookie,
 * then `Accept-Language` negotiation, then the default locale.
 */
export function resolvePreAccountLocale(request: Request): Locale {
  return getLocaleCookie(request) ?? negotiateAcceptLanguage(request) ?? defaultLocale;
}

/**
 * Language for the current request. A logged-in profile's instruction language
 * is authoritative for the app UI; otherwise fall back to the pre-account
 * chain.
 */
export function resolveLocale(request: Request): Locale {
  const profile = request.activeProfile;
  if (profile) {
    return profile.instructionLanguage;
  }

  return resolvePreAccountLocale(request);
}

function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...valueParts] = part.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(valueParts.join('=')).trim() || null;
    }
  }

  return null;
}
