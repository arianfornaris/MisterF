import type { Request, Response } from 'express';
import { env } from '../config/env.js';

export type ResourceLayout = 'cards' | 'list';

export const practiceModulesLayoutCookieName = 'misterf_practice_modules_layout';
export const chatroomsLayoutCookieName = 'misterf_chatrooms_layout';
export const assignmentsLayoutCookieName = 'misterf_assignments_layout';
export const resourcesLayoutCookieName = 'misterf_resources_layout';

function readCookieValue(
  cookieHeader: string | undefined,
  cookieName: string,
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

  return cookies.get(cookieName)?.trim() || null;
}

function normalizeResourceLayout(value: unknown): ResourceLayout {
  return value === 'list' ? 'list' : 'cards';
}

export function resolveResourceLayout(
  request: Request,
  response: Response,
  cookieName: string,
): ResourceLayout {
  const requestedLayout =
    typeof request.query.layout === 'string' ? request.query.layout.trim() : '';

  if (requestedLayout === 'cards' || requestedLayout === 'list') {
    response.cookie(cookieName, requestedLayout, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.appBaseUrl.startsWith('https://'),
      path: '/',
    });

    return requestedLayout;
  }

  const storedLayout = readCookieValue(request.headers.cookie, cookieName);
  return normalizeResourceLayout(storedLayout);
}
