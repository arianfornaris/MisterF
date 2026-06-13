/**
 * A button/link to an existing practice module.
 *
 * Use only when the learner explicitly asked for a saved practice-module link
 * or when you are completing an explicit learner-mandated practice-module
 * administration action. A current practice module context is not enough by
 * itself. Never invent ids, slugs, URLs, or module results.
 */
interface PracticeModuleLinkBlock {
  /** Literal discriminator. */
  type: "practice_module_link";
  /** Real practice-module id obtained from tool results or current context; use it only after an explicit link/module-administration request. */
  practiceModuleId: string;
  /** Must be a short Spanish label shown on the link/button. */
  label: string;
}
