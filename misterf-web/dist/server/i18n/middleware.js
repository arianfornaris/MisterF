import { createTranslator, getClientCatalogJson, isLocale, languageOptions, } from './index.js';
import { getLocaleCookie, resolveLocale, setLocaleCookie } from './resolve.js';
import { translatorLanguagesJson } from './translatorLanguages.js';
/**
 * Resolves the request locale and exposes it to every render as `res.locals.t`,
 * `res.locals.locale`, and `res.locals.htmlLang`. A `?lang=` query parameter is
 * an explicit switcher: it stores the cookie and redirects to the clean URL.
 */
export function attachLocale(request, response, next) {
    const queryLang = request.query.lang;
    if ((request.method === 'GET' || request.method === 'HEAD') &&
        isLocale(queryLang) &&
        getLocaleCookie(request) !== queryLang) {
        setLocaleCookie(response, queryLang);
        response.redirect(stripLangQuery(request.originalUrl || request.path));
        return;
    }
    const locale = resolveLocale(request);
    request.locale = locale;
    response.locals.clientI18nJson = getClientCatalogJson(locale);
    response.locals.htmlLang = locale;
    response.locals.languages = languageOptions();
    response.locals.locale = locale;
    response.locals.t = createTranslator(locale);
    response.locals.translatorLanguagesJson = translatorLanguagesJson();
    next();
}
function stripLangQuery(originalUrl) {
    const [pathname, query] = originalUrl.split('?');
    if (!query) {
        return pathname;
    }
    const params = new URLSearchParams(query);
    params.delete('lang');
    const rest = params.toString();
    return rest ? `${pathname}?${rest}` : pathname;
}
//# sourceMappingURL=middleware.js.map