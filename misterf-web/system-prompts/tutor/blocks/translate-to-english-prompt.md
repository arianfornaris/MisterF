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
 */
interface TranslateToEnglishPromptBlock {
  /** Literal discriminator. */
  type: "translate_to_english_prompt";
  /** The single Spanish sentence the learner should translate. */
  sentence: string;
}
