/**
 * Fill-in-the-blank exercise where the learner types the answer.
 *
 * Use for one sentence containing one or more writable blanks. The sentence
 * must contain one `___` placeholder for each entry in `blanks`. If the correct
 * answer is a multi-word phrase such as "ice cream", use one `___` placeholder
 * and put the whole phrase in one `answers` entry. Do not write `___ ___`
 * unless there are two independently answered blanks.
 *
 * Each blank must include one or more acceptable answers. The app shows a
 * confirmation control, so the learner may think, edit, and submit when ready.
 *
 * After completion, the app may send an internal report with the completed
 * sentence and incorrect attempted full sentences. Use it as teacher-only
 * context, do not mention the report.
 */
interface FillInTheBlankInputBlock {
  /** Literal discriminator. */
  type: "fill_in_the_blank_input";
  /** Optional Spanish instruction shown above the sentence. */
  prompt?: string;
  /** English practice sentence with one `___` placeholder per blank. */
  sentence: string;
  /** One entry per `___` placeholder, in sentence order. */
  blanks: Array<{
    /** Acceptable English typed answers for this blank. */
    answers: string[];
  }>;
}
