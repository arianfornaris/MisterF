import { loadSystemPrompt } from '../systemPrompts.js';

export type InstructionLanguage = 'en' | 'es';

export const defaultInstructionLanguage: InstructionLanguage = 'es';

const englishNames: Record<InstructionLanguage, string> = {
  en: 'English',
  es: 'Spanish',
};

export function instructionLanguageEnglishName(
  language: InstructionLanguage,
): string {
  return englishNames[language];
}

/**
 * Placeholder values injected into the tutor system prompt so that
 * `tutor/system.md` stays single-source while its language-specific copy
 * (learner-facing examples, translation-block enumerations, UI nouns, and the
 * language-rules section) varies by the profile's instruction language.
 *
 * The Spanish values must reproduce the pre-parametrization prompt verbatim so
 * existing Spanish conversations are byte-for-byte unchanged; this is guarded
 * by the golden snapshot test.
 */
export function tutorSystemLanguagePlaceholders(
  language: InstructionLanguage,
): Record<string, string> {
  return {
    DIRECTION_OPTIONS_LETTERED: directionOptionsLettered[language],
    DIRECTION_OPTIONS_LIST: directionOptionsList[language],
    INSTRUCTION_LANGUAGE_NAME: instructionLanguageEnglishName(language),
    LANGUAGE_RULES: loadSystemPrompt(`tutor/language-rules/${language}.md`).trim(),
    LEARNER_AUDIENCE_CLAUSE: learnerAudienceClause[language],
    TRANSLATION_EXERCISE_BLOCK_COMBINATIONS:
      translationExerciseBlockCombinations[language],
    TRANSLATION_EXERCISE_BLOCKS_INLINE: translationExerciseBlocksInline[language],
    UI_PRACTICE_GUIDE_TERM: uiPracticeGuideTerm[language],
    UI_RESOURCES_TERM: uiResourcesTerm[language],
  };
}

export function conversationTitleLanguageRule(
  language: InstructionLanguage,
): string {
  return language === 'es'
    ? "The title must be short, Spanish, human-friendly, and specific; avoid generic titles such as \"Práctica de inglés\", \"Conversación\", or \"Resumen de conversación\"."
    : 'The title must be short, English, human-friendly, and specific; avoid generic titles such as "English practice", "Conversation", or "Conversation summary".';
}

const learnerAudienceClause: Record<InstructionLanguage, string> = {
  en: '',
  es: ' for Spanish-speaking learners',
};

const directionOptionsList: Record<InstructionLanguage, string> = {
  en: '  - practice vocabulary\n  - practice with sentences\n  - do a mini conversation',
  es: '  - practicar vocabulario\n  - practicar con frases\n  - hacer una mini conversación',
};

const directionOptionsLettered: Record<InstructionLanguage, string> = {
  en: '`a) practice vocabulary`, `b) practice with sentences`, `c) do a mini conversation`',
  es: '`a) practicar vocabulario`, `b) practicar con frases`, `c) hacer una mini conversación`',
};

const translationExerciseBlocksInline: Record<InstructionLanguage, string> = {
  en: '',
  es: ', `translate_to_english_prompt`, `understand_in_spanish_prompt`',
};

const translationExerciseBlockCombinations: Record<InstructionLanguage, string> = {
  en: '',
  es: '\n  - `message` plus `translate_to_english_prompt`\n  - `message` plus `understand_in_spanish_prompt`',
};

const uiPracticeGuideTerm: Record<InstructionLanguage, string> = {
  en: 'practice guide',
  es: 'guía de práctica',
};

const uiResourcesTerm: Record<InstructionLanguage, string> = {
  en: 'Resources',
  es: 'Recursos',
};
