import { env } from '../config/env.js';
export const activeProfileCookieName = 'misterf_profile';
export function getActiveProfileId(request) {
    return getActiveProfileIdFromCookieHeader(request.headers.cookie);
}
export function getActiveProfileIdFromCookieHeader(cookieHeader) {
    if (!cookieHeader) {
        return null;
    }
    const cookies = new Map(cookieHeader.split(';').map((cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        return [name, decodeURIComponent(valueParts.join('='))];
    }));
    return cookies.get(activeProfileCookieName)?.trim() || null;
}
export function setActiveProfileCookie(response, profileId) {
    response.cookie(activeProfileCookieName, profileId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.appBaseUrl.startsWith('https://'),
        path: '/',
    });
}
export function clearActiveProfileCookie(response) {
    response.clearCookie(activeProfileCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.appBaseUrl.startsWith('https://'),
        path: '/',
    });
}
//# sourceMappingURL=profiles.js.map