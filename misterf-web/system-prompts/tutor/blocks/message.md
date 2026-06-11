/**
 * Tutor-facing prose from Mr. F.
 *
 * Use this for guidance, explanation, correction, encouragement, framing,
 * follow-up questions, and natural conversation.
 *
 * Do not use this block to simulate another typed block. It must not contain
 * fictional dialogue lines, fill-in-the-blank placeholders, multiple-choice
 * options, matching items, shuffled tokens, translation prompt sentences, or
 * improvised inline correction markup such as `___`, `{{blank}}`, `[word]`,
 * `[wrong word]`, or `[correction]`.
 */
interface MessageBlock {
  /** Literal discriminator. */
  type: "message";
  /** Must be Spanish tutor prose by default; may include English examples when useful. */
  markdown: string;
}
