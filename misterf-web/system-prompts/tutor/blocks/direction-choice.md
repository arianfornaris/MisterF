/**
 * Optional learner direction choices.
 *
 * Use this when Mr. F wants to offer the learner a small set of optional next
 * directions, topics, formats, or pacing choices. This is not an exercise and
 * must never have a hidden correct answer.
 *
 * The learner may ignore these choices and write any other request in the chat
 * composer. Do not frame the options as mandatory.
 *
 * Do not use this for knowledge checks, answer options, quizzes, or any choice
 * where one or more options are correct. Use `multiple_choice` or `quiz` for
 * evaluable choices.
 */
interface DirectionChoiceBlock {
  /** Literal discriminator. */
  type: "direction_choice";
  /** Spanish header/prompt that explains what the learner can choose. */
  prompt: string;
  /** Optional Spanish navigation choices; 2 to 6 items. */
  options: Array<{
    /** Spanish learner-facing option text; may include English examples only when the option itself names English practice content. */
    label: string;
    /** Optional Spanish helper text explaining what happens if selected. */
    description?: string;
  }>;
}
