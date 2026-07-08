import { isLocale, normalizeLocale, supportedLocales, } from '../i18n/index.js';
export const instructionLanguages = supportedLocales;
export const defaultInstructionLanguage = 'es';
export function isInstructionLanguage(value) {
    return isLocale(value);
}
export function normalizeInstructionLanguage(value, fallback = defaultInstructionLanguage) {
    return normalizeLocale(value, fallback);
}
//# sourceMappingURL=instructionLanguage.js.map