import { env } from '../config/env.js';
export const practiceModulesLayoutCookieName = 'misterf_practice_modules_layout';
export const chatroomsLayoutCookieName = 'misterf_chatrooms_layout';
function readCookieValue(cookieHeader, cookieName) {
    if (!cookieHeader) {
        return null;
    }
    const cookies = new Map(cookieHeader.split(';').map((cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        return [name, decodeURIComponent(valueParts.join('='))];
    }));
    return cookies.get(cookieName)?.trim() || null;
}
function normalizeResourceLayout(value) {
    return value === 'list' ? 'list' : 'cards';
}
export function resolveResourceLayout(request, response, cookieName) {
    const requestedLayout = typeof request.query.layout === 'string' ? request.query.layout.trim() : '';
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
//# sourceMappingURL=resourceLayout.js.map