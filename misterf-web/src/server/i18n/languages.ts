import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { ht } from './locales/ht.js';

export type LocaleCatalog = {
  readonly [key: string]: string | LocaleCatalog;
};

/**
 * Per-language tutor-prompt snippets injected into the system and block
 * prompts. Keeping them here (next to the rest of a language's config) means
 * adding a language is a single registry entry plus its content files, not a
 * sweep across the codebase. Spanish values must reproduce the
 * pre-parametrization prompt verbatim — the golden snapshot test guards this.
 */
export type TutorLanguagePack = {
  learnerAudienceClause: string;
  directionOptionsList: string;
  directionOptionsLettered: string;
  translationExerciseBlocksInline: string;
  translationExerciseBlockCombinations: string;
  translationUnionMembers: string;
  quizTranslationItemUnion: string;
  uiPracticeGuideTerm: string;
  uiResourcesTerm: string;
  conversationTitleRule: string;
};

export type LanguageDefinition = {
  /** The language's own name, shown in language pickers. */
  endonym: string;
  /** English name, used inside English meta-prompts. */
  englishName: string;
  /**
   * True when the tutor teaches this language monolingually (no
   * translation-based scaffolding, translation blocks excluded).
   */
  monolingual: boolean;
  /** Marks a beta language; pickers surface it as experimental. */
  experimental?: boolean;
  catalog: LocaleCatalog;
  tutor: TutorLanguagePack;
};

/**
 * Single source of truth for every supported instruction language. To add a
 * language: add one entry here (plus its `locales/<code>.ts` catalog and
 * `system-prompts/tutor/language-rules/<code>.md`). The `Locale` type, the
 * supported-locale list, the UI language pickers, and every parametrized
 * prompt derive from this object. See docs/architecture/i18n.md.
 */
export const languages = {
  es: {
    endonym: 'Español',
    englishName: 'Spanish',
    monolingual: false,
    experimental: false,
    catalog: es,
    tutor: {
      learnerAudienceClause: ' for Spanish-speaking learners',
      directionOptionsList:
        '  - practicar vocabulario\n  - practicar con frases\n  - hacer una mini conversación',
      directionOptionsLettered:
        '`a) practicar vocabulario`, `b) practicar con frases`, `c) hacer una mini conversación`',
      translationExerciseBlocksInline:
        ', `translate_to_english_prompt`, `understand_in_spanish_prompt`',
      translationExerciseBlockCombinations:
        '\n  - `message` plus `translate_to_english_prompt`\n  - `message` plus `understand_in_spanish_prompt`',
      translationUnionMembers:
        '\n  | TranslateToEnglishPromptBlock\n  | UnderstandInSpanishPromptBlock',
      quizTranslationItemUnion:
        '\n  | QuizTranslateToEnglishItem\n  | QuizUnderstandInSpanishItem',
      uiPracticeGuideTerm: 'guía de práctica',
      uiResourcesTerm: 'Recursos',
      conversationTitleRule:
        'The title must be short, Spanish, human-friendly, and specific; avoid generic titles such as "Práctica de inglés", "Conversación", or "Resumen de conversación".',
    },
  },
  en: {
    endonym: 'English',
    englishName: 'English',
    monolingual: true,
    experimental: false,
    catalog: en,
    tutor: {
      learnerAudienceClause: '',
      directionOptionsList:
        '  - practice vocabulary\n  - practice with sentences\n  - do a mini conversation',
      directionOptionsLettered:
        '`a) practice vocabulary`, `b) practice with sentences`, `c) do a mini conversation`',
      translationExerciseBlocksInline: '',
      translationExerciseBlockCombinations: '',
      translationUnionMembers: '',
      quizTranslationItemUnion: '',
      uiPracticeGuideTerm: 'practice guide',
      uiResourcesTerm: 'Resources',
      conversationTitleRule:
        'The title must be short, English, human-friendly, and specific; avoid generic titles such as "English practice", "Conversation", or "Conversation summary".',
    },
  },
  ht: {
    endonym: 'Kreyòl ayisyen',
    englishName: 'Haitian Creole',
    // A support language (explanations in Creole), but the two translation
    // blocks are Spanish-specific, so its block set matches the monolingual
    // one until a Creole-specific comprehension block exists.
    monolingual: false,
    experimental: true,
    catalog: ht,
    tutor: {
      learnerAudienceClause: ' for Haitian Creole-speaking learners',
      directionOptionsList:
        '  - pratike vokabilè\n  - pratike ak fraz\n  - fè yon ti konvèsasyon',
      directionOptionsLettered:
        '`a) pratike vokabilè`, `b) pratike ak fraz`, `c) fè yon ti konvèsasyon`',
      translationExerciseBlocksInline: '',
      translationExerciseBlockCombinations: '',
      translationUnionMembers: '',
      quizTranslationItemUnion: '',
      uiPracticeGuideTerm: 'gid pratik',
      uiResourcesTerm: 'Resous',
      conversationTitleRule:
        'The title must be short, in Haitian Creole, human-friendly, and specific; avoid generic titles such as "Pratik anglè", "Konvèsasyon", or "Rezime konvèsasyon".',
    },
  },
} as const satisfies Record<string, LanguageDefinition>;

export type Locale = keyof typeof languages;

export const supportedLocales = Object.keys(languages) as Locale[];

export const defaultLocale: Locale = 'en';

/** Language option list for rendering pickers and switchers. */
export function languageOptions(): {
  code: Locale;
  endonym: string;
  experimental: boolean;
}[] {
  return supportedLocales.map((code) => ({
    code,
    endonym: languages[code].endonym,
    experimental: Boolean(languages[code].experimental),
  }));
}
