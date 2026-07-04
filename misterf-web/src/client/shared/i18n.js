// Client-side i18n helper. Reads the locale dictionary the server injects into
// `window.__APP_I18N__` (see the i18n middleware and app-shell-close.ejs) and
// mirrors the server `translate()` semantics: dot-path lookup, `{{name}}`
// interpolation, and a visible fallback to the key when a string is missing.

const catalog =
  (typeof window !== 'undefined' && window.__APP_I18N__) || {};

export const locale =
  (typeof window !== 'undefined' && window.__APP_LOCALE__) || 'es';

function lookup(key) {
  let current = catalog;
  for (const segment of key.split('.')) {
    if (current == null || typeof current === 'string') {
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
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

export function t(key, params) {
  const template = lookup(key);
  if (template === undefined) {
    if (typeof console !== 'undefined') {
      console.warn(`[i18n] missing client translation key: ${key}`);
    }
    return key;
  }
  return interpolate(template, params);
}
