import { env } from '../config/env.js';
import { defaultLocale, isLocale, supportedLocales, } from './index.js';
export const languageCookieName = 'misterf_lang';
export function getLocaleCookie(request) {
    const raw = readCookie(request.headers.cookie, languageCookieName);
    return isLocale(raw) ? raw : null;
}
export function setLocaleCookie(response, locale) {
    response.cookie(languageCookieName, locale, {
        httpOnly: false,
        maxAge: 1000 * 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
        secure: env.appBaseUrl.startsWith('https://'),
    });
}
export function negotiateAcceptLanguage(request) {
    const negotiated = request.acceptsLanguages(...supportedLocales);
    return isLocale(negotiated) ? negotiated : null;
}
/**
 * Language a visitor sees before any account exists: explicit switcher cookie,
 * then `Accept-Language` negotiation, then the default locale.
 */
export function resolvePreAccountLocale(request) {
    return getLocaleCookie(request) ?? negotiateAcceptLanguage(request) ?? defaultLocale;
}
/**
 * Language for the current request. A logged-in profile's instruction language
 * is authoritative for the app UI; otherwise fall back to the pre-account
 * chain.
 */
export function resolveLocale(request) {
    const profile = request.activeProfile;
    if (profile) {
        return profile.instructionLanguage;
    }
    return resolvePreAccountLocale(request);
}
function readCookie(cookieHeader, name) {
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
//# sourceMappingURL=resolve.js.map