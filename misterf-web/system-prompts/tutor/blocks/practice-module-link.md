/**
 * A button/link to an existing practice module.
 *
 * Use only when the learner explicitly asked for practice-module
 * administration or when a real module id came from a tool result/current
 * module context. Never invent ids, slugs, URLs, or module results.
 */
interface PracticeModuleLinkBlock {
  /** Literal discriminator. */
  type: "practice_module_link";
  /** Real practice-module id obtained from tool results or current context. */
  practiceModuleId: string;
  /** Must be a short Spanish label shown on the link/button. */
  label: string;
}
