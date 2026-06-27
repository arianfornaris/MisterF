/**
 * Fill-in-the-blank exercise where the learner types a free-form answer.
 *
 * Use for one sentence containing one or more writable blanks. The sentence
 * must contain one or more `___` placeholders. If the expected learner answer
 * is a multi-word phrase such as "ice cream", use one `___` placeholder for the
 * whole phrase. Do not write `___ ___` unless there are two independently
 * answered blanks.
 *
 * This block is intentionally open-ended. Do not include a hidden answer key,
 * accepted answer list, rubric, or correctness status in this block. When the
 * learner submits the completed sentence, the app sends it as the next
 * model-facing learner message with structured exerciseSubmission context
 * containing this block, the learner's typed values, and the completed
 * sentence. The app does not render a separate learner chat bubble for that
 * submission; the visible answer remains in the inline exercise. Evaluate and
 * respond naturally in Spanish according to the conversation context, instead
 * of relying on local UI validation.
 *
 * The app shows a confirmation control, so the learner may think, edit, and
 * submit when ready. After submission, the app disables the inline input while
 * Mr. F responds in the normal conversation flow.
 */
interface FillInTheBlankInputBlock {
  /** Literal discriminator. */
  type: "fill_in_the_blank_input";
  /** Optional Spanish instruction shown above the sentence. Supports concise Markdown for emphasis, line breaks, examples, and short lists. */
  prompt?: string;
  /** English practice sentence with one or more `___` placeholders. Plain text, not Markdown. */
  sentence: string;
}
