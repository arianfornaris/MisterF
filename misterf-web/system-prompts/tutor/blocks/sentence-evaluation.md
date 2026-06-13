/**
 * One visible part of learner text being evaluated.
 *
 * `text` must be an actual contiguous fragment from `sourceText`. Never use an
 * empty string, whitespace, or placeholder fragment for missing words. If words
 * are missing, explain that in `explanation` or a separate `message`.
 *
 * The ordered `EvaluationPart.text` values are not a list of only the errors.
 * Together, they must reconstruct the complete `sourceText`. Include correct,
 * improvable, and erroneous fragments so the UI can show the whole evaluated
 * text.
 *
 * Use `correct`, `improve`, or `error`. Use `correct` for text that is part of
 * the reviewed sentence but does not need feedback. Keep explanations short,
 * specific, and useful.
 */
interface EvaluationPart {
  /** Exact visible learner text fragment from `sourceText`; preserve its original language. */
  text: string;
  /** Evaluation status for this fragment. */
  status: "correct" | "improve" | "error";
  /** Short Spanish explanation, required in practice for `improve` or `error`. */
  explanation?: string;
}

/**
 * Inline evaluation of one concrete learner text.
 *
 * Use when the learner writes or asks you to review English text that should
 * be corrected. This block is a standalone tutor response block: it is not
 * attached to a user message by id, metadata, or hidden state.
 *
 * This block does not have to evaluate an entire long learner text at once.
 * When studying a long text step by step, use it to evaluate one complete
 * sentence, clause, or meaningful excerpt extracted from that larger text.
 * After that, continue with the next excerpt in later turns as needed.
 *
 * You may evaluate the latest learner answer or an earlier learner text when
 * the learner explicitly asks for it or when you are deliberately breaking down
 * a long previous text for study. In every case, include the complete evaluated
 * excerpt in `sourceText`; do not rely on external message references.
 *
 * `parts` must be an ordered partition of `sourceText`. If the `text` values in
 * `parts` are concatenated, they must match `sourceText` after normalizing by
 * lowercasing and ignoring whitespace and punctuation. This means `parts` must
 * include the correct text between problems, not only the problem fragments.
 *
 * Only include this block when at least one part should be marked `improve` or
 * `error`. If the evaluated learner text is fully correct, do not emit this
 * block.
 *
 * Until the learner writes the requested answer correctly, stay on the same
 * task and keep guiding with hints, corrections, smaller clues, or partial
 * help. Do not give the full literal answer too early except in an extreme case
 * where the learner is clearly stuck after repeated attempts.
 */
interface SentenceEvaluationBlock {
  /** Literal discriminator. */
  type: "sentence_evaluation";
  /** Complete learner text or excerpt being reviewed; preserve the learner's original language. */
  sourceText: string;
  /** Ordered partition of `sourceText`; include correct, improvable, and erroneous fragments, preserving original language in each `text`. */
  parts: EvaluationPart[];
}
