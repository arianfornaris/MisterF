import { loadSystemPrompt } from '../systemPrompts.js';
import { languages, type Locale } from '../../i18n/index.js';

export type InstructionLanguage = Locale;

export const defaultInstructionLanguage: InstructionLanguage = 'es';

export function instructionLanguageEnglishName(
  language: InstructionLanguage,
): string {
  return languages[language].englishName;
}

/**
 * Placeholder values injected into the tutor system prompt so that
 * `tutor/system.md` stays single-source while its language-specific copy
 * (learner-facing examples, translation-block enumerations, UI nouns, and the
 * language-rules section) varies by the profile's instruction language. The
 * per-language values live in the language registry (`i18n/languages.ts`).
 */
export function tutorSystemLanguagePlaceholders(
  language: InstructionLanguage,
): Record<string, string> {
  const pack = languages[language].tutor;
  return {
    DIRECTION_OPTIONS_LETTERED: pack.directionOptionsLettered,
    DIRECTION_OPTIONS_LIST: pack.directionOptionsList,
    INSTRUCTION_LANGUAGE_NAME: languages[language].englishName,
    LANGUAGE_RULES: loadSystemPrompt(`tutor/language-rules/${language}.md`).trim(),
    LEARNER_AUDIENCE_CLAUSE: pack.learnerAudienceClause,
    TRANSLATION_EXERCISE_BLOCK_COMBINATIONS: pack.translationExerciseBlockCombinations,
    TRANSLATION_EXERCISE_BLOCKS_INLINE: pack.translationExerciseBlocksInline,
    UI_PRACTICE_GUIDE_TERM: pack.uiPracticeGuideTerm,
    UI_RESOURCES_TERM: pack.uiResourcesTerm,
  };
}

/**
 * Placeholder values applied to each tutor block document during protocol
 * composition. `INSTRUCTION_LANGUAGE_NAME` parametrizes the language every
 * learner-facing field must be authored in; `TRANSLATION_UNION_MEMBERS` drops
 * the translation-based blocks from the `TutorResponseBlock` union for a
 * monolingual block set so the union has no dangling members.
 */
export function tutorBlockProtocolPlaceholders(
  language: InstructionLanguage,
): Record<string, string> {
  return {
    INSTRUCTION_LANGUAGE_NAME: languages[language].englishName,
    TRANSLATION_UNION_MEMBERS: languages[language].tutor.translationUnionMembers,
  };
}

export function conversationTitleLanguageRule(
  language: InstructionLanguage,
): string {
  return languages[language].tutor.conversationTitleRule;
}
