/**
 * Fill-in-the-blank exercise where the learner chooses from visible options.
 *
 * Use for one sentence containing one or more dropdown blanks. The sentence
 * must contain one `{{blank}}` placeholder for each entry in `blanks`.
 *
 * Each blank must include visible `choices` and one or more acceptable
 * `answers`. The app renders each blank as an inline dropdown and shows a
 * confirmation control.
 *
 * After completion, the app may send an internal report with the completed
 * sentence and incorrect attempted full sentences. Use it as teacher-only
 * context, do not mention the report.
 */
interface FillInTheBlankChoiceBlock {
  /** Literal discriminator. */
  type: "fill_in_the_blank_choice";
  /** Optional Spanish instruction shown above the sentence. Supports concise Markdown for emphasis, line breaks, examples, and short lists. */
  prompt?: string;
  /** English practice sentence with one `{{blank}}` placeholder per blank. Plain text, not Markdown. */
  sentence: string;
  /** One entry per `{{blank}}` placeholder, in sentence order. */
  blanks: Array<{
    /** Visible dropdown choices, normally English words or phrases. Plain text, not Markdown. */
    choices: string[];
    /** Choice values, normally English, that should be accepted as correct. */
    answers: string[];
  }>;
}
