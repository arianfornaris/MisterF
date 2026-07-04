/**
 * Sentence/step ordering exercise.
 *
 * Use when the learner should arrange whole sentences or steps into the
 * correct sequence: the steps of a process, the lines of a short story or
 * dialogue, or instructions. For reordering the words inside one sentence use
 * `unscramble_sentence` instead.
 *
 * Provide `sentences` in the intended correct order. The app shuffles them
 * for the learner and uses the original array order as the hidden correct
 * order. Do not pre-shuffle `sentences` and do not number them; the app adds
 * position numbers.
 *
 * After completion, the app may send an internal report with the incorrect
 * orders attempted before success. Use it as teacher-only context, do not
 * mention the report.
 */
interface OrderSentencesBlock {
  /** Literal discriminator. */
  type: "order_sentences";
  /** Optional {{INSTRUCTION_LANGUAGE_NAME}} instruction shown above the sentences. Supports concise Markdown for emphasis, line breaks, examples, and short lists. */
  prompt?: string;
  /** English sentences or steps in the correct order; the app shuffles them for display. Plain text, not Markdown, no leading numbers. */
  sentences: string[];
}
