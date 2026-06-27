/**
 * Interactive matching practice.
 *
 * Use when the learner should match items from one column to another:
 * vocabulary, translations, definitions, meanings, question-answer pairs, or
 * any other pedagogically useful pairing.
 *
 * Provide the correct pairs only. The app will visually separate columns and
 * shuffle one side. Do not generate ids, local keys, shuffled orders,
 * `leftItems`, `rightItems`, or `correctPairs` metadata for this top-level
 * block.
 *
 * After completion, the app may send an internal report with incorrect
 * attempts. Use it as teacher-only context, do not mention the report.
 */
interface MatchingPairsBlock {
  /** Literal discriminator. */
  type: "matching_pairs";
  /** Optional Spanish instruction shown above the matching exercise. Supports concise Markdown for emphasis, line breaks, examples, and short lists. */
  prompt?: string;
  /** Correct pairs only; the app derives shuffled columns from these values. */
  pairs: Array<{
    /** Left-side item; may be Spanish, English, or mixed depending on the pairing. Plain text, not Markdown. */
    left: string;
    /** Correct right-side match for `left`; may be Spanish, English, or mixed. Plain text, not Markdown. */
    right: string;
  }>;
}
