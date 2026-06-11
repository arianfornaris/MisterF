/**
 * Interactive multiple-choice exercise.
 *
 * Use when the learner should select one or more options. Use `single` when
 * exactly one option is correct, and `multiple` when several options may be
 * correct. Every option must be marked with `isCorrect`.
 *
 * If `selectionMode` is `single`, exactly one option must have
 * `isCorrect: true`. The app lets the learner select options and confirm with
 * a checkmark.
 *
 * After completion, the app may send an internal report with incorrect
 * selections before success. Use it as teacher-only context, do not mention the
 * report.
 */
interface MultipleChoiceBlock {
  /** Literal discriminator. */
  type: "multiple_choice";
  /** Optional Spanish setup shown above the question. */
  prompt?: string;
  /** Learner-facing question; Spanish by default unless English text is the practice content. */
  question: string;
  /** `single` for one correct option; `multiple` for several possible correct options. */
  selectionMode: "single" | "multiple";
  /** Visible answer options. */
  options: Array<{
    /** Learner-facing option text; Spanish by default unless English text is the answer content. */
    text: string;
    /** Whether this option is correct. */
    isCorrect: boolean;
  }>;
}
