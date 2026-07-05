/**
 * Languages the translator can pair with English. Unlike the instruction
 * language (registry in `languages.ts`, currently es/en), the translator is
 * LLM-powered and can handle any language, so this is a curated picker list —
 * English is always the other side of the pair and is intentionally excluded.
 *
 * `code` is the short tag used for the toolbar label (uppercased) and the
 * browser's stored preference; `endonym` is shown in the picker; `englishName`
 * is what the translation prompt names the language.
 */
export type TranslatorLanguage = {
  code: string;
  endonym: string;
  englishName: string;
};

export const translatorLanguages: readonly TranslatorLanguage[] = [
  { code: 'es', endonym: 'Español', englishName: 'Spanish' },
  { code: 'ht', endonym: 'Kreyòl ayisyen', englishName: 'Haitian Creole' },
  { code: 'fr', endonym: 'Français', englishName: 'French' },
  { code: 'pt', endonym: 'Português', englishName: 'Portuguese' },
  { code: 'it', endonym: 'Italiano', englishName: 'Italian' },
  { code: 'de', endonym: 'Deutsch', englishName: 'German' },
  { code: 'zh', endonym: '中文', englishName: 'Chinese' },
  { code: 'ar', endonym: 'العربية', englishName: 'Arabic' },
  { code: 'ru', endonym: 'Русский', englishName: 'Russian' },
  { code: 'vi', endonym: 'Tiếng Việt', englishName: 'Vietnamese' },
];

export const defaultTranslatorLanguageCode = 'es';

export function findTranslatorLanguage(
  code: unknown,
): TranslatorLanguage | undefined {
  return typeof code === 'string'
    ? translatorLanguages.find((language) => language.code === code)
    : undefined;
}

export function resolveTranslatorLanguage(code: unknown): TranslatorLanguage {
  return (
    findTranslatorLanguage(code) ??
    findTranslatorLanguage(defaultTranslatorLanguageCode)!
  );
}

export function translatorLanguagesJson(): string {
  return JSON.stringify(translatorLanguages).replace(/</g, '\\u003c');
}
