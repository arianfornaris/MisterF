import { defaultLocale, languages, supportedLocales, } from './languages.js';
export { defaultLocale, languageOptions, languages, supportedLocales, } from './languages.js';
const catalogs = Object.fromEntries(supportedLocales.map((code) => [code, languages[code].catalog]));
export function isLocale(value) {
    return (typeof value === 'string' &&
        supportedLocales.includes(value));
}
export function normalizeLocale(value, fallback = defaultLocale) {
    return isLocale(value) ? value : fallback;
}
/**
 * Resolves a dot-separated key against a locale catalog, falling back to the
 * default locale and finally to the key itself so missing strings are visible
 * rather than crashing. Supports `{{name}}` interpolation from `params`.
 */
export function translate(locale, key, params) {
    const template = lookup(catalogs[locale], key) ?? lookup(catalogs[defaultLocale], key);
    if (typeof template !== 'string') {
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn(`[i18n] missing translation key: ${key}`);
        }
        return key;
    }
    return interpolate(template, params);
}
export function createTranslator(locale) {
    return (key, params) => translate(locale, key, params);
}
/**
 * The subset of the catalog exposed to browser scripts. Client bundles read
 * these namespaces from `window.__APP_I18N__`; server-only namespaces are not
 * shipped to the client.
 */
const clientNamespaces = ['chat', 'nav', 'translator', 'clientChat', 'card', 'clientMisc'];
export function getClientCatalog(locale) {
    const source = catalogs[locale];
    const fallback = catalogs[defaultLocale];
    const result = {};
    for (const namespace of clientNamespaces) {
        result[namespace] = source[namespace] ?? fallback[namespace] ?? {};
    }
    return result;
}
export function getClientCatalogJson(locale) {
    // Escape `<` so the JSON cannot break out of the inline <script> tag.
    return JSON.stringify(getClientCatalog(locale)).replace(/</g, '\\u003c');
}
function lookup(catalog, key) {
    let current = catalog;
    for (const segment of key.split('.')) {
        if (current === undefined || typeof current === 'string') {
            return undefined;
        }
        current = current[segment];
    }
    return typeof current === 'string' ? current : undefined;
}
function interpolate(template, params) {
    if (!params) {
        return template;
    }
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
        const value = params[name];
        return value === undefined ? match : String(value);
    });
}
//# sourceMappingURL=index.js.map