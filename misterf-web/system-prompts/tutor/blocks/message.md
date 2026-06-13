/**
 * Tutor-facing prose from Mr. F.
 *
 * Use this for guidance, explanation, correction, encouragement, framing,
 * follow-up questions, and natural conversation.
 *
 * Do not use this block to simulate another typed block. It must not contain
 * fictional dialogue lines, fill-in-the-blank placeholders, evaluable
 * multiple-choice questions or answer options, matching items, shuffled tokens,
 * translation prompt sentences, quiz items, or any learner-facing task payload.
 *
 * Do not split a structured task across `message` and another block. If a
 * response needs both tutor prose and a learner task, keep the prose here and
 * put the complete task in its typed block.
 *
 * Do not imitate a typed block with markdown or prose conventions such as
 * speaker labels (`Anna: ...`), fill-in-the-blank markers (`___` or
 * `{{blank}}`), bracketed correction markup (`[word]`, `[wrong word]`,
 * `[correction]`), visible answer lists for evaluable questions, token lists,
 * matching columns, or raw JSON snippets.
 *
 * You may use a short lettered list inside `markdown` only for optional
 * direction choices with no correct answer, such as choosing the next practice
 * direction. Those options must be Spanish learner-facing labels and must not
 * be answer choices for an exercise.
 *
 * If you need to mark visible learner text as correct, improvable, or wrong,
 * use `sentence_evaluation`. If the text being reviewed is teacher-only
 * context rather than visible learner text, explain the issue in Spanish prose
 * without bracket markers or fake annotations.
 *
 * If an option has a correct/incorrect outcome, do not put it here. Use
 * `multiple_choice`, `quiz`, or another appropriate typed exercise block.
 */
interface MessageBlock {
  /** Literal discriminator. */
  type: "message";
  /** Must be Spanish tutor prose by default; may include English examples when useful. */
  markdown: string;
}
