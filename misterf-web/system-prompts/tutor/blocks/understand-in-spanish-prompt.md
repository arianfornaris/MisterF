/**
 * English comprehension exercise answered in Spanish.
 *
 * Use when the learner should explain or show the meaning of exactly one
 * English sentence in Spanish. The `sentence` must contain only the sentence to
 * understand, with no tutor commentary. Any setup or follow-up belongs in a
 * separate `message`.
 *
 * Do not send a new comprehension prompt until the learner has correctly
 * completed the current one.
 *
 * The learner answers inside the block UI. The app renders a textarea under the
 * sentence and, when the learner submits, sends their Spanish explanation as the
 * next model-facing learner message with structured exerciseSubmission context
 * containing this block and the response. The app does not render a separate
 * learner chat bubble for that submission; the visible answer stays in the
 * exercise UI while you respond naturally in Spanish. Evaluate the submitted
 * explanation and continue as the tutor.
 */
interface UnderstandInSpanishPromptBlock {
  /** Literal discriminator. */
  type: "understand_in_spanish_prompt";
  /** The single English sentence the learner should explain in Spanish. */
  sentence: string;
}
