import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { ht } from './locales/ht.js';

export type LocaleCatalog = {
  readonly [key: string]: string | LocaleCatalog;
};

/**
 * Per-language tutor-prompt snippets injected into the system and block
 * prompts. Spanish values must reproduce the pre-parametrization prompt
 * verbatim — the golden snapshot test guards this.
 */
export type TutorLanguagePack = {
  learnerAudienceClause: string;
  directionOptionsList: string;
  directionOptionsLettered: string;
  translationExerciseBlocksInline: string;
  translationExerciseBlockCombinations: string;
  translationUnionMembers: string;
  quizTranslationItemUnion: string;
  /**
   * True only for languages that use the Spanish `translate_to_english` /
   * `understand_in_spanish` blocks and quiz items (they are Spanish-hardcoded).
   * Drives block-set and quiz-protocol composition, replacing `=== 'es'`.
   */
  includesSpanishTranslationBlocks: boolean;
  uiPracticeGuideTerm: string;
  uiResourcesTerm: string;
  conversationTitleRule: string;
};

/**
 * Ephemeral greetings the tutor shows before the learner's first message.
 * `pickInitialGreeting` / `pickKnownVisitorGreeting` choose one at random.
 */
export type LanguageGreetings = {
  initial: string[];
  knownVisitor: string[];
};

/**
 * Per-instruction-language regexes for the support-language exercise
 * instructions a tutor might leak into a `message` block. Structural cues that
 * don't depend on the support language (blank underscores, bracket markup,
 * evaluation JSON shape) live in the block-repair detector, not here.
 */
export type LeakagePatterns = {
  translation: RegExp;
  unscramble: RegExp;
  orderSentences: RegExp;
  matching: RegExp;
  multipleChoice: RegExp;
  openWriting: RegExp;
  revision: RegExp;
  ownWords: RegExp;
  correctionAnalysisPolite: RegExp;
  correctionAnalysisDirect: RegExp;
  correctionKeywords: RegExp;
  evaluationKeywords: RegExp;
};

/**
 * Everything that defines a supported instruction language, in one object.
 * Adding a language is a single entry here — the type makes it exhaustive, so
 * the compiler lists every field you still owe.
 */
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
  greetings: LanguageGreetings;
  leakagePatterns: LeakagePatterns;
};

/**
 * Single source of truth for every supported instruction language. To add a
 * language: add one entry here (plus its `locales/<code>.ts` catalog and
 * `system-prompts/tutor/language-rules/<code>.md`). The `Locale` type, the
 * supported-locale list, the UI language pickers, the greetings, the
 * block-repair patterns, and every parametrized prompt derive from this
 * object. See docs/architecture/i18n.md.
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
      includesSpanishTranslationBlocks: true,
      uiPracticeGuideTerm: 'guía de práctica',
      uiResourcesTerm: 'Recursos',
      conversationTitleRule:
        'The title must be short, Spanish, human-friendly, and specific; avoid generic titles such as "Práctica de inglés", "Conversación", or "Resumen de conversación".',
    },
    greetings: {
      initial: [
        `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar hoy?`,
        `¡Bienvenido! Soy Mr. F, tu tutor de inglés. ¿Qué tema te gustaría practicar hoy?`,
        `¡Hola! Soy Mr. F, tu tutor de inglés. Cuéntame qué quieres trabajar hoy.`,
        `¡Qué bueno verte! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar?`,
        `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué parte quieres practicar hoy?`,
        `¡Empezamos! Soy Mr. F, tu tutor de inglés. ¿Qué te gustaría mejorar hoy?`,
        `¡Hola! Soy Mr. F, tu tutor de inglés. Dime qué quieres practicar y lo vamos armando juntos.`,
        `¡Bienvenido! Soy Mr. F, tu tutor de inglés. ¿Sobre qué tema quieres practicar?`,
        `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar: una situación, una duda o un tema?`,
        `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué necesitas practicar hoy?`,
      ],
      knownVisitor: [
        [
          '¡Hola de nuevo! Soy Mr. F, tu tutor para practicar inglés. Me alegra verte por aquí.',
          'Si ya tienes tu cuenta, puedes [iniciar sesión](/login) y seguimos con tu práctica.',
          'Si todavía no la has creado, también puedes [crear una cuenta](/signup).',
        ].join('\n\n'),
        [
          '¡Bienvenido otra vez! Soy Mr. F, y este espacio es para practicar inglés contigo. Qué gusto tenerte de vuelta.',
          'Si ya habías entrado antes, [inicia sesión](/login) y continuamos desde ahí.',
          'Si lo prefieres, también puedes [crear una cuenta](/signup).',
        ].join('\n\n'),
        [
          '¡Hola! Soy Mr. F, tu tutor de inglés. Creo que ya nos habíamos visto antes.',
          'Si ya tienes tu cuenta, [inicia sesión](/login) y retomamos la práctica.',
          'Y si todavía no, puedes [crear una cuenta](/signup) en un momento.',
        ].join('\n\n'),
        [
          '¡Qué bueno verte de nuevo! Soy Mr. F, y aquí puedes practicar inglés conmigo cuando quieras.',
          'Si ya tienes tu cuenta, [inicia sesión](/login) y seguimos trabajando juntos.',
          'Si aún no la tienes, puedes [crear una cuenta](/signup).',
        ].join('\n\n'),
        [
          '¡Hola otra vez! Soy Mr. F, tu tutor para practicar inglés. Cuando quieras, seguimos.',
          'Si ya tienes tu cuenta, [inicia sesión](/login) para continuar.',
          'Si todavía no, puedes [crear una cuenta](/signup).',
        ].join('\n\n'),
      ],
    },
    leakagePatterns: {
      translation:
        /\btraduce(?:\s+(?:la\s+)?(?:siguiente\s+)?(?:frase|oraci[oó]n|texto))?\s+al\s+ingl[eé]s\b\s*:?/i,
      unscramble: /\b(?:ordena|reordena)\b[\s\S]{0,180}\b(?:palabras|oraci[oó]n|frase)\b/i,
      orderSentences:
        /\b(?:ordena|reordena|pon)\b[\s\S]{0,180}\b(?:pasos|oraciones|frases|instrucciones|eventos)\b/i,
      matching:
        /\b(?:une|relaciona|empareja)\b[\s\S]{0,180}\b(?:con|cada|correct[ao]s?|significado|traducci[oó]n|pareja)\b/i,
      multipleChoice:
        /\b(?:elige|escoge|selecciona|marca)\b[\s\S]{0,180}\b(?:opci[oó]n correcta|respuesta correcta|la correcta)\b/i,
      openWriting:
        /\b(?:escrib(?:e|es|a|as|an|ir|ir[ií]a(?:s|n)?|iendo)|redact(?:a|as|an|e|es|en|ar|ar[ií]a(?:s|n)?)|crea(?:r|s|n)?|forma(?:r|s|n)?|constru(?:ye|yes|ya|yas|yan|ir|ir[ií]a(?:s|n)?))\b[\s\S]{0,180}\b(?:oraci[oó]n(?:es)?|frase(?:s)?|respuesta|p[aá]rrafo|texto|ejemplo)\b/i,
      revision:
        /\b(?:corrige(?:s|n)?|corrija(?:s|n)?|corregir(?:[ií]a(?:s|n)?)?|reescrib(?:e|es|a|as|an|ir|ir[ií]a(?:s|n)?|iendo))\b[\s\S]{0,180}\b(?:oraci[oó]n(?:es)?|frase(?:s)?|respuesta|p[aá]rrafo|texto|ejemplo)\b/i,
      ownWords:
        /\b(?:respond(?:e|es|a|as|an|er|er[ií]a(?:s|n)?)|contest(?:a|as|an|e|es|en|ar|ar[ií]a(?:s|n)?))\b[\s\S]{0,180}\bcon\s+tus\s+propias\s+palabras\b/i,
      correctionAnalysisPolite:
        /\b(?:puedes|podr[ií]as|podr[ií]an|puede[sn]?)\s+(?:decirme|decirnos|identificar|se[nñ]alar|explicar|indicar|encontrar)\b[\s\S]{0,280}\b(?:error(?:es)?|equivocaci[oó]n(?:es)?|problema(?:s)?)\b[\s\S]{0,280}\b(?:corregir(?:lo|la|los|las)?|corregir[ií]as|corregir[ií]an|corrige(?:lo|la|los|las)?|corriges|corrigen|correcci[oó]n|correcciones)\b/i,
      correctionAnalysisDirect:
        /\b(?:cu[aá]l(?:es)?\s+(?:es|son)\s+(?:el|los)?\s*error(?:es)?|encuentra\s+(?:el|los)?\s*error(?:es)?|identifica\s+(?:el|los)?\s*error(?:es)?)\b[\s\S]{0,280}\b(?:corregir(?:lo|la|los|las)?|corregir[ií]as|corregir[ií]an|corrige(?:lo|la|los|las)?|corriges|corrigen|correcci[oó]n|correcciones)\b/i,
      correctionKeywords:
        /\b(?:corrige|correcci[oó]n|correcciones|errores|reescribe|reescribir|int[eé]ntalo)\b/i,
      evaluationKeywords: /\b(?:evaluaci[oó]n|revisemos esta parte|pista con la evaluaci[oó]n)\b/i,
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
      includesSpanishTranslationBlocks: false,
      uiPracticeGuideTerm: 'practice guide',
      uiResourcesTerm: 'Resources',
      conversationTitleRule:
        'The title must be short, English, human-friendly, and specific; avoid generic titles such as "English practice", "Conversation", or "Conversation summary".',
    },
    greetings: {
      initial: [
        `Hi! I'm Mr. F, your English tutor. What would you like to review today?`,
        `Welcome! I'm Mr. F, your English tutor. What topic would you like to practice today?`,
        `Hi! I'm Mr. F, your English tutor. Tell me what you'd like to work on today.`,
        `Great to see you! I'm Mr. F, your English tutor. What would you like to review?`,
        `Hi! I'm Mr. F, your English tutor. Which part would you like to practice today?`,
        `Let's get started! I'm Mr. F, your English tutor. What would you like to improve today?`,
        `Hi! I'm Mr. F, your English tutor. Tell me what you want to practice and we'll build it together.`,
        `Welcome! I'm Mr. F, your English tutor. What topic would you like to practice?`,
        `Hi! I'm Mr. F, your English tutor. What would you like to review: a situation, a question, or a topic?`,
        `Hi! I'm Mr. F, your English tutor. What do you need to practice today?`,
      ],
      knownVisitor: [
        [
          'Hi again! I\'m Mr. F, your tutor for practicing English. Glad to see you here.',
          'If you already have an account, you can [log in](/login) and we\'ll continue your practice.',
          'If you haven\'t created one yet, you can also [create an account](/signup).',
        ].join('\n\n'),
        [
          'Welcome back! I\'m Mr. F, and this space is for practicing English with you. Great to have you back.',
          'If you\'ve been here before, [log in](/login) and we\'ll continue from there.',
          'If you prefer, you can also [create an account](/signup).',
        ].join('\n\n'),
        [
          'Hi! I\'m Mr. F, your English tutor. I think we\'ve met before.',
          'If you already have an account, [log in](/login) and we\'ll pick the practice back up.',
          'And if you don\'t yet, you can [create an account](/signup) in a moment.',
        ].join('\n\n'),
        [
          'Great to see you again! I\'m Mr. F, and here you can practice English with me whenever you want.',
          'If you already have an account, [log in](/login) and we\'ll keep working together.',
          'If you don\'t have one yet, you can [create an account](/signup).',
        ].join('\n\n'),
        [
          'Hi again! I\'m Mr. F, your tutor for practicing English. Whenever you\'re ready, we\'ll continue.',
          'If you already have an account, [log in](/login) to continue.',
          'If you don\'t yet, you can [create an account](/signup).',
        ].join('\n\n'),
      ],
    },
    leakagePatterns: {
      translation:
        /\btranslate\b(?:\s+(?:the\s+)?(?:following\s+)?(?:sentence|phrase|text|this|that|it))?\s+(?:in)?to\s+english\b\s*:?/i,
      unscramble: /\b(?:unscramble|reorder|rearrange|arrange)\b[\s\S]{0,180}\b(?:words?|sentence)\b/i,
      orderSentences:
        /\b(?:order|reorder|arrange|put)\b[\s\S]{0,180}\b(?:steps?|sentences?|events?|instructions?)\b[\s\S]{0,60}\bin\s+(?:the\s+)?(?:right\s+|correct\s+)?order\b/i,
      matching:
        /\b(?:match|pair|connect|link)\b[\s\S]{0,180}\b(?:with|each|correct|meaning|translation|pair)\b/i,
      multipleChoice:
        /\b(?:choose|pick|select|mark)\b[\s\S]{0,180}\b(?:correct\s+(?:option|answer)|right\s+(?:option|answer)|the\s+correct\s+one)\b/i,
      openWriting:
        /\b(?:write|compose|create)\b[\s\S]{0,180}\b(?:sentences?|phrases?|answer|paragraphs?|text|examples?)\b/i,
      revision:
        /\b(?:rewrite|fix)\b[\s\S]{0,180}\b(?:sentences?|phrases?|answer|paragraphs?|text|examples?)\b|\bcorrect\s+(?:this|the|your|these|that|it|them)\b[\s\S]{0,160}\b(?:sentences?|phrases?|answer|paragraphs?|text|examples?)\b/i,
      ownWords: /\b(?:answer|respond|explain|describe)\b[\s\S]{0,180}\bin\s+your\s+own\s+words\b/i,
      correctionAnalysisPolite:
        /\b(?:can|could)\s+you\s+(?:tell\s+me|point\s+out|identify|find|spot|explain)\b[\s\S]{0,280}\b(?:error|mistake|problem)s?\b[\s\S]{0,280}\b(?:correct|fix|rewrite)\b/i,
      correctionAnalysisDirect:
        /\b(?:what(?:'s| is| are)\s+(?:the\s+)?(?:error|mistake)s?|find\s+(?:the\s+)?(?:error|mistake)s?|identify\s+(?:the\s+)?(?:error|mistake)s?)\b[\s\S]{0,280}\b(?:correct|fix|rewrite)\b/i,
      correctionKeywords: /\b(?:correct|correction|errors?|mistakes?|rewrite|try\s+again)\b/i,
      evaluationKeywords: /\b(?:evaluation|let'?s\s+review\s+this\s+part|hint\s+with\s+the\s+evaluation)\b/i,
    },
  },
  ht: {
    endonym: 'Kreyòl ayisyen',
    englishName: 'Haitian Creole',
    // A support language (explanations in Creole), but the two translation
    // blocks are Spanish-specific, so its block set matches the monolingual
    // one until a Creole-specific comprehension block exists.
    monolingual: false,
    experimental: false,
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
      includesSpanishTranslationBlocks: false,
      uiPracticeGuideTerm: 'gid pratik',
      uiResourcesTerm: 'Resous',
      conversationTitleRule:
        'The title must be short, in Haitian Creole, human-friendly, and specific; avoid generic titles such as "Pratik anglè", "Konvèsasyon", or "Rezime konvèsasyon".',
    },
    greetings: {
      initial: [
        `Bonjou! Mwen se Mr. F, titè anglè ou. Kisa ou vle repase jodi a?`,
        `Byenveni! Mwen se Mr. F, titè anglè ou. Ki sijè ou ta renmen pratike jodi a?`,
        `Bonjou! Mwen se Mr. F, titè anglè ou. Di m kisa ou vle travay sou li jodi a.`,
        `Kontan wè ou! Mwen se Mr. F, titè anglè ou. Kisa ou vle repase?`,
        `Ann kòmanse! Mwen se Mr. F, titè anglè ou. Kisa ou ta renmen amelyore jodi a?`,
        `Bonjou! Mwen se Mr. F, titè anglè ou. Di m kisa ou vle pratike epi n ap monte l ansanm.`,
      ],
      knownVisitor: [
        [
          'Bonjou ankò! Mwen se Mr. F, titè ou pou pratike anglè. Mwen kontan wè ou isit la.',
          'Si ou gen yon kont deja, ou ka [konekte](/login) epi n ap kontinye pratik ou.',
          'Si ou poko kreye youn, ou ka [kreye yon kont](/signup) tou.',
        ].join('\n\n'),
        [
          'Byenveni ankò! Mwen se Mr. F, epi espas sa a se pou pratike anglè avè w. Mwen kontan wè ou tounen.',
          'Si ou te deja vin isit la, [konekte](/login) epi n ap kontinye apati la.',
          'Si ou pito, ou ka [kreye yon kont](/signup) tou.',
        ].join('\n\n'),
        [
          'Bonjou! Mwen se Mr. F, titè anglè ou. Mwen kwè nou te deja wè.',
          'Si ou gen yon kont deja, [konekte](/login) epi n ap reprann pratik la.',
          'Si ou poko, ou ka [kreye yon kont](/signup) nan yon moman.',
        ].join('\n\n'),
      ],
    },
    leakagePatterns: {
      // No trailing \b after accented finals: JS \b is ASCII-only, so it fails
      // right after letters like "è" (anglè, erè).
      translation: /\btradui\b[\s\S]{0,40}\ban\s+angl[eè]/i,
      unscramble: /\b(?:ranje|reranje|mete)\b[\s\S]{0,180}\b(?:mo|fraz)\b/i,
      orderSentences:
        /\b(?:ranje|mete)\b[\s\S]{0,180}\b(?:etap|fraz|enstriksyon|evènman)\b[\s\S]{0,60}\ban\s+l[oò]d\b/i,
      matching:
        /\b(?:marye|konekte|asosye)\b[\s\S]{0,180}\b(?:ak|chak|k[oò]r[eè]k|siyifikasyon|tradiksyon|p[eè])\b/i,
      multipleChoice:
        /\b(?:chwazi|make)\b[\s\S]{0,180}\b(?:bon\s+(?:opsyon|repons)|opsyon\s+k[oò]r[eè]k|repons\s+k[oò]r[eè]k)\b/i,
      openWriting: /\b(?:ekri|kreye|fòme|konstwi)\b[\s\S]{0,180}\b(?:fraz|repons|paragraf|t[eè]ks|egzanp)\b/i,
      revision: /\b(?:korije|reekri)\b[\s\S]{0,180}\b(?:fraz|repons|paragraf|t[eè]ks)\b/i,
      ownWords: /\b(?:reponn|eksplike)\b[\s\S]{0,180}\bnan\s+pw[oò]p\s+mo\s+ou\b/i,
      correctionAnalysisPolite:
        /\b(?:[eè]ske\s+ou\s+ka(?:pab)?|ou\s+ka(?:pab)?)\s+(?:di\s+m|idantifye|montre|jwenn|eksplike)\b[\s\S]{0,280}\ber[eè][\s\S]{0,280}\bkorije\b/i,
      correctionAnalysisDirect:
        /\b(?:ki(?:l[eè]s)?\s+er[eè]|jwenn\s+er[eè]|idantifye\s+er[eè])[\s\S]{0,280}\bkorije\b/i,
      correctionKeywords: /\b(?:korije|koreksyon|er[eè]|reekri|eseye\s+ank[oò])/i,
      evaluationKeywords: /\b(?:evalyasyon|ann\s+revize\s+pati\s+sa)\b/i,
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
