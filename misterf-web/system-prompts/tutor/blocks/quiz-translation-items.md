/** Quiz item where the learner translates one Spanish sentence to English. */
interface QuizTranslateToEnglishItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_translate_to_english";
  /** Learner-facing item instruction; must be {{INSTRUCTION_LANGUAGE_NAME}}. Supports concise Markdown for emphasis, line breaks, examples, and short lists. */
  prompt: string;
  /** Spanish sentence to translate. Plain text, not Markdown. */
  sentence: string;
  /** Optional hidden acceptable English answers for evaluation. */
  acceptableAnswers?: string[];
  /** Hidden evaluator guidance; must be {{INSTRUCTION_LANGUAGE_NAME}} and must not be revealed. */
  rubric?: string;
}

/** Quiz item where the learner explains one English sentence in Spanish. */
interface QuizUnderstandInSpanishItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_understand_in_spanish";
  /** Learner-facing item instruction; must be {{INSTRUCTION_LANGUAGE_NAME}}. Supports concise Markdown for emphasis, line breaks, examples, and short lists. */
  prompt: string;
  /** English sentence to understand. Plain text, not Markdown. */
  sentence: string;
  /** Optional hidden acceptable Spanish explanations or meanings. */
  acceptableAnswers?: string[];
  /** Hidden evaluator guidance; must be {{INSTRUCTION_LANGUAGE_NAME}} and must not be revealed. */
  rubric?: string;
}
