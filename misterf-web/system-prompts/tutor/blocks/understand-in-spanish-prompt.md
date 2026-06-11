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
 */
interface UnderstandInSpanishPromptBlock {
  /** Literal discriminator. */
  type: "understand_in_spanish_prompt";
  /** The single English sentence the learner should explain in Spanish. */
  sentence: string;
}
