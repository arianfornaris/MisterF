import { en } from './locales/en.js';
import { es } from './locales/es.js';

export const supportedLocales = ['es', 'en'] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'en';

export type TranslationParams = Record<string, string | number>;

export type Translator = (key: string, params?: TranslationParams) => string;

const catalogs: Record<Locale, LocaleCatalog> = { en, es };

export type LocaleCatalog = {
  readonly [key: string]: string | LocaleCatalog;
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (supportedLocales as readonly string[]).includes(value)
  );
}

export function normalizeLocale(
  value: unknown,
  fallback: Locale = defaultLocale,
): Locale {
  return isLocale(value) ? value : fallback;
}

/**
 * Resolves a dot-separated key against a locale catalog, falling back to the
 * default locale and finally to the key itself so missing strings are visible
 * rather than crashing. Supports `{{name}}` interpolation from `params`.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: TranslationParams,
): string {
  const template =
    lookup(catalogs[locale], key) ?? lookup(catalogs[defaultLocale], key);

  if (typeof template !== 'string') {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing translation key: ${key}`);
    }
    return key;
  }

  return interpolate(template, params);
}

export function createTranslator(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}

function lookup(catalog: LocaleCatalog, key: string): string | undefined {
  let current: string | LocaleCatalog | undefined = catalog;

  for (const segment of key.split('.')) {
    if (current === undefined || typeof current === 'string') {
      return undefined;
    }
    current = current[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
