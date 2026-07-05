import {
  isLocale,
  normalizeLocale,
  supportedLocales,
  type Locale,
} from '../i18n/index.js';

/**
 * A profile's instruction language is the same set as the UI locale. The type
 * and the list derive from the language registry (`i18n/languages.ts`); only
 * the default differs — new/unseeded profiles default to Spanish, while the UI
 * fallback for anonymous visitors is the registry default.
 */
export type InstructionLanguage = Locale;

export const instructionLanguages: readonly InstructionLanguage[] = supportedLocales;

export const defaultInstructionLanguage: InstructionLanguage = 'es';

export function isInstructionLanguage(
  value: unknown,
): value is InstructionLanguage {
  return isLocale(value);
}

export function normalizeInstructionLanguage(
  value: unknown,
  fallback: InstructionLanguage = defaultInstructionLanguage,
): InstructionLanguage {
  return normalizeLocale(value, fallback);
}
