/** Open-answer quiz item. The evaluator uses `rubric` when present. */
interface QuizOpenTextItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_open_text";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** Optional textarea placeholder; must be Spanish. */
  placeholder?: string;
  /** Hidden evaluator guidance; must be Spanish and must not be revealed. */
  rubric?: string;
}

/** Quiz item where the learner translates one Spanish sentence to English. */
interface QuizTranslateToEnglishItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_translate_to_english";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** Spanish sentence to translate. */
  sentence: string;
  /** Optional hidden acceptable English answers for evaluation. */
  acceptableAnswers?: string[];
  /** Hidden evaluator guidance; must be Spanish and must not be revealed. */
  rubric?: string;
}

/** Quiz item where the learner explains one English sentence in Spanish. */
interface QuizUnderstandInSpanishItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_understand_in_spanish";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** English sentence to understand. */
  sentence: string;
  /** Optional hidden acceptable Spanish explanations or meanings. */
  acceptableAnswers?: string[];
  /** Hidden evaluator guidance; must be Spanish and must not be revealed. */
  rubric?: string;
}

/**
 * Quiz fill-in-the-blank item where the learner types answers.
 *
 * Use `___` placeholders in `sentence`, one per `blanks` entry.
 */
interface QuizFillInTheBlankInputItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_fill_in_the_blank_input";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** English practice sentence with one `___` placeholder per blank. */
  sentence: string;
  /** One entry per placeholder, in sentence order. */
  blanks: Array<{
    /** Optional hidden accepted English answers for this blank. */
    acceptableAnswers?: string[];
    /** Optional hidden evaluator guidance for this blank; must be Spanish. */
    rubric?: string;
  }>;
}

/**
 * Quiz fill-in-the-blank item where the learner chooses answers.
 *
 * Use `{{blank}}` placeholders in `sentence`, one per `blanks` entry.
 */
interface QuizFillInTheBlankChoiceItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_fill_in_the_blank_choice";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** English practice sentence with one `{{blank}}` placeholder per blank. */
  sentence: string;
  /** One entry per placeholder, in sentence order. */
  blanks: Array<{
    /** Visible dropdown choices, normally English words or phrases. */
    choices: string[];
    /** Optional hidden accepted choices/answers, normally English. */
    acceptableAnswers?: string[];
    /** Optional hidden evaluator guidance for this blank; must be Spanish. */
    rubric?: string;
  }>;
}

/**
 * Quiz multiple-choice item.
 *
 * Item kinds inside quiz are intentionally prefixed with `quiz_`; do not use
 * the top-level `multiple_choice` block shape inside a quiz. If `selectionMode`
 * is `single`, `correctOptions` must contain exactly one option.
 */
interface QuizMultipleChoiceItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_multiple_choice";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** `single` for one correct option; `multiple` for several correct options. */
  selectionMode: "single" | "multiple";
  /** Visible answer option texts; language depends on the question content. */
  options: string[];
  /** Hidden list of exact option texts that are correct; preserve option language. */
  correctOptions: string[];
  /** Hidden evaluator guidance; must be Spanish and must not be revealed. */
  rubric?: string;
}

/**
 * Quiz matching item.
 *
 * Include all visible left and right items plus the hidden correct pairs. The
 * quiz must be self-contained, so do not rely on surrounding conversation for
 * the learner or evaluator to understand the item.
 */
interface QuizMatchingPairsItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_matching_pairs";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** Visible left-column items; may be Spanish, English, or mixed by design. */
  leftItems: string[];
  /** Visible right-column items; may be Spanish, English, or mixed by design. */
  rightItems: string[];
  /** Hidden correct pair mapping. */
  correctPairs: Array<{
    /** Left item text from `leftItems`; preserve its language exactly. */
    left: string;
    /** Correct matching right item text from `rightItems`; preserve its language exactly. */
    right: string;
  }>;
  /** Hidden evaluator guidance; must be Spanish and must not be revealed. */
  rubric?: string;
}

/**
 * Quiz sentence unscramble item.
 *
 * Provide `tokens` in correct order; the app shuffles them for the learner.
 * Use `acceptableAnswers` only when alternate complete orders are genuinely
 * acceptable.
 */
interface QuizUnscrambleSentenceItem {
  /** Literal quiz item discriminator. */
  kind: "quiz_unscramble_sentence";
  /** Learner-facing item instruction; must be Spanish. */
  prompt: string;
  /** English sentence pieces in correct order; the app shuffles them for display. */
  tokens: string[];
  /** Optional hidden alternate complete English answers that should be accepted. */
  acceptableAnswers?: string[];
  /** Hidden evaluator guidance; must be Spanish and must not be revealed. */
  rubric?: string;
}

type QuizItem =
  | QuizOpenTextItem
  | QuizTranslateToEnglishItem
  | QuizUnderstandInSpanishItem
  | QuizFillInTheBlankInputItem
  | QuizFillInTheBlankChoiceItem
  | QuizMultipleChoiceItem
  | QuizMatchingPairsItem
  | QuizUnscrambleSentenceItem;

/**
 * Self-contained multi-question assessment or review.
 *
 * Treat this block like an exam, test, diagnostic check, or checkpoint review,
 * not like a regular exercise. Use it when the learner asks for a quiz, examen,
 * prueba, or test; when you intentionally need to explore what the learner
 * already knows across several related items; or when you want to verify what
 * has been learned after a meaningful stretch of practice.
 *
 * Do not use `quiz` for ordinary single-question practice, especially at the
 * beginning of a conversation. For regular practice, use the specific top-level
 * exercise blocks such as `multiple_choice`, `fill_in_the_blank_input`,
 * `fill_in_the_blank_choice`, `matching_pairs`, `unscramble_sentence`,
 * translation prompts, dialogue blocks, or normal `message` guidance.
 *
 * A quiz contains several items and is submitted as a whole; the app will not
 * auto-correct items one by one.
 *
 * Every item kind must begin with `quiz_`. Never use non-prefixed item kinds
 * such as `open_text`, `multiple_choice`, `matching_pairs`,
 * `fill_in_the_blank_choice`, or `unscramble_sentence` inside a quiz.
 *
 * Do not use dialogue practice inside a quiz. Include all visible data the
 * learner needs inside each item. Use `rubric` for hidden evaluator guidance
 * only; do not expose hidden criteria in normal tutor prose.
 *
 * After submission, the app may send an internal completion report with the
 * original quiz, learner responses, and hidden answer/rubric data. Use it as
 * teacher-only context and then evaluate naturally with concise feedback.
 */
interface QuizBlock {
  /** Literal discriminator. */
  type: "quiz";
  /** Optional short Spanish quiz title. */
  title?: string;
  /** Global learner-facing instruction for the whole quiz; must be Spanish. */
  prompt: string;
  /** Optional hidden evaluator guidance for the whole quiz; must be Spanish. */
  rubric?: string;
  /** Ordered quiz questions/items shown one at a time; at least 2 items because a one-question check should use a regular exercise block. */
  items: QuizItem[];
}
