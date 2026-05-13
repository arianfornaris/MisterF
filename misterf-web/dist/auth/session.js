import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
export const sessionCookieName = 'misterf_session';
export const knownVisitorCookieName = 'misterf_known_visitor';
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
const knownVisitorDurationMs = 365 * 24 * 60 * 60 * 1000;
export function createSessionCookie() {
    const token = randomBytes(32).toString('base64url');
    return {
        expiresAt: new Date(Date.now() + sessionDurationMs),
        token,
        tokenHash: hashSessionToken(token),
    };
}
export function getSessionToken(request) {
    return getSessionTokenFromCookieHeader(request.headers.cookie);
}
export function getSessionTokenFromCookieHeader(cookieHeader) {
    return getCookieValue(cookieHeader, sessionCookieName);
}
export function hasKnownVisitorCookie(request) {
    return getCookieValue(request.headers.cookie, knownVisitorCookieName) === '1';
}
function getCookieValue(cookieHeader, cookieName) {
    if (!cookieHeader) {
        return null;
    }
    const cookies = new Map(cookieHeader.split(';').map((cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        return [name, decodeURIComponent(valueParts.join('='))];
    }));
    return cookies.get(cookieName) ?? null;
}
export function hashSessionToken(token) {
    return createHmac('sha256', requireSessionSecret())
        .update(token)
        .digest('base64url');
}
export function setSessionCookie(response, session) {
    response.cookie(sessionCookieName, session.token, {
        expires: session.expiresAt,
        httpOnly: true,
        sameSite: 'lax',
        secure: env.appBaseUrl.startsWith('https://'),
        path: '/',
    });
}
export function clearSessionCookie(response) {
    response.clearCookie(sessionCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.appBaseUrl.startsWith('https://'),
        path: '/',
    });
}
export function setKnownVisitorCookie(response) {
    response.cookie(knownVisitorCookieName, '1', {
        expires: new Date(Date.now() + knownVisitorDurationMs),
        httpOnly: true,
        sameSite: 'lax',
        secure: env.appBaseUrl.startsWith('https://'),
        path: '/',
    });
}
export function requireSessionSecret() {
    if (!env.sessionSecret || env.sessionSecret.length < 32) {
        throw new Error('APP_SESSION_SECRET must be at least 32 characters long.');
    }
    return env.sessionSecret;
}
//# sourceMappingURL=session.js.map