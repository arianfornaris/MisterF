/**
 * Sentence unscramble exercise.
 *
 * Use when the learner should rebuild a sentence from shuffled pieces.
 * Provide `tokens` in the intended correct order. The app will shuffle them
 * for the learner and will use the original array order as the hidden correct
 * order.
 *
 * Do not pre-shuffle `tokens`. After completion, the app may send an internal
 * report with incorrect full sentences attempted before success. Use it as
 * teacher-only context, do not mention the report.
 */
interface UnscrambleSentenceBlock {
  /** Literal discriminator. */
  type: "unscramble_sentence";
  /** Optional Spanish instruction shown above the tokens. Supports concise Markdown for emphasis, line breaks, examples, and short lists. */
  prompt?: string;
  /** English sentence pieces in the correct order; the app shuffles them for display. Plain text, not Markdown. */
  tokens: string[];
}
