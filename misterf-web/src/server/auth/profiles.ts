import type { Request, Response } from 'express';
import { env } from '../config/env.js';

export const activeProfileCookieName = 'misterf_profile';

export function getActiveProfileId(request: Request): string | null {
  return getActiveProfileIdFromCookieHeader(request.headers.cookie);
}

export function getActiveProfileIdFromCookieHeader(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = new Map(
    cookieHeader.split(';').map((cookie) => {
      const [name, ...valueParts] = cookie.trim().split('=');
      return [name, decodeURIComponent(valueParts.join('='))];
    }),
  );

  return cookies.get(activeProfileCookieName)?.trim() || null;
}

export function setActiveProfileCookie(response: Response, profileId: string): void {
  response.cookie(activeProfileCookieName, profileId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.appBaseUrl.startsWith('https://'),
    path: '/',
  });
}

export function clearActiveProfileCookie(response: Response): void {
  response.clearCookie(activeProfileCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.appBaseUrl.startsWith('https://'),
    path: '/',
  });
}
