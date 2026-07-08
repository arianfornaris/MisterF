export const translatorLanguages = [
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
export function findTranslatorLanguage(code) {
    return typeof code === 'string'
        ? translatorLanguages.find((language) => language.code === code)
        : undefined;
}
export function resolveTranslatorLanguage(code) {
    return (findTranslatorLanguage(code) ??
        findTranslatorLanguage(defaultTranslatorLanguageCode));
}
export function translatorLanguagesJson() {
    return JSON.stringify(translatorLanguages).replace(/</g, '\\u003c');
}
//# sourceMappingURL=translatorLanguages.js.map