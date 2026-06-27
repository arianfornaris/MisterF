/**
 * Open-ended writing exercise answered inside the block UI.
 *
 * Use when the learner should write, rewrite, correct, explain, or produce one
 * open-ended answer that is not covered by a more specific block such as
 * `translate_to_english_prompt`, `understand_in_spanish_prompt`,
 * `fill_in_the_blank_input`, `multiple_choice`, `matching_pairs`, or
 * `unscramble_sentence`.
 *
 * This block is model-evaluated. Do not include an answer key, accepted answer
 * list, visible correctness status, or local validation hints. When the learner
 * submits the textarea, the app sends the answer as the next model-facing
 * learner message with structured exerciseSubmission context containing this
 * block and the learner's response. The app does not render a separate learner
 * chat bubble for that submission; the visible answer remains in the exercise
 * UI while Mr. F responds naturally in Spanish.
 *
 * Prefer this block over `message` for prompts such as "escribe una oración",
 * "redacta", "reescribe", "corrige estas oraciones", or "responde con tus
 * propias palabras" when the learner is expected to submit an evaluable answer.
 *
 * Keep this block granular. Ask for one learner-produced sentence, correction,
 * explanation, or example at a time. If a plan or practice module calls for
 * several open-ended answers, emit the first `open_text_prompt`, evaluate it
 * after submission, and then continue with the next one. Use `quiz` instead
 * when several open-ended answers must be submitted and evaluated together as a
 * checkpoint.
 */
interface OpenTextPromptBlock {
  /** Literal discriminator. */
  type: "open_text_prompt";
  /** Spanish learner-facing instruction shown above the textarea. */
  prompt: string;
  /** Optional visible scaffold text for the textarea; must be Spanish or English depending on the expected answer. */
  placeholder?: string;
  /** Optional short Spanish button label. If omitted or invalid, the app uses "Enviar respuesta". */
  submitLabel?: string;
  /** Optional hidden Spanish evaluator guidance for Mr. F. Do not reveal it to the learner. */
  rubric?: string;
}
