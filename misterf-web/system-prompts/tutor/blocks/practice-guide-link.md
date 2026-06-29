/**
 * A button/link to an existing practice guide.
 *
 * Use only when the learner explicitly asked for a saved practice-guide link
 * or when you are completing an explicit learner-mandated practice-guide
 * administration action. A current practice guide context is not enough by
 * itself. Never invent ids, slugs, URLs, or practice-guide results.
 */
interface PracticeGuideLinkBlock {
  /** Literal discriminator. */
  type: "practice_guide_link";
  /** Real practice-guide id obtained from tool results or current context; use it only after an explicit link/practice-guide administration request. */
  practiceGuideId: string;
  /** Must be a short Spanish label shown on the link/button. */
  label: string;
}
