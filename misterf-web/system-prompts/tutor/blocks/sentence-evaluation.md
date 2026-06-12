/**
 * One visible part of learner text being evaluated.
 *
 * `text` must be actual visible text from the learner text under review. Never
 * use an empty string, whitespace, or placeholder fragment for missing words.
 * If words are missing, explain that in `explanation` or a separate `message`.
 *
 * Use `correct`, `improve`, or `error`. Keep explanations short, specific, and
 * useful.
 */
interface EvaluationPart {
  /** Exact visible learner text fragment being evaluated; preserve its original language. */
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
 * You may evaluate the latest learner answer or an earlier learner text when
 * the learner explicitly asks for it or when you are deliberately breaking down
 * a long previous text for study. In every case, include the exact visible text
 * fragments being evaluated in `parts`; do not rely on external message
 * references.
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
  /** Ordered fragments covering the learner text being reviewed; preserve the learner's original language in `text`. */
  parts: EvaluationPart[];
}
