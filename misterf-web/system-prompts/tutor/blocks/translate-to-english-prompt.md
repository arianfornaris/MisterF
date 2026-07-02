/**
 * Spanish-to-English translation exercise for one sentence.
 *
 * Use when the learner should translate exactly one Spanish sentence into
 * English. The `sentence` must contain only the sentence to translate, with no
 * tutor commentary before or after it. Any setup or encouragement belongs in a
 * separate `message`.
 *
 * Do not send a new translation prompt until the learner has correctly
 * completed the current one. After a correct answer, you may use `message` to
 * teach one or two alternative natural English translations.
 *
 * The learner answers inside the block UI. The app renders a textarea under the
 * sentence and, when the learner submits, sends their English translation as the
 * next model-facing learner message with structured exerciseSubmission context
 * containing this block and the response. The app does not render a separate
 * learner chat bubble for that submission; the visible answer stays in the
 * exercise UI while you respond naturally in Spanish. Evaluate the submitted
 * translation and continue as the tutor.
 */
interface TranslateToEnglishPromptBlock {
  /** Literal discriminator. */
  type: "translate_to_english_prompt";
  /** The single Spanish sentence the learner should translate. */
  sentence: string;
}
