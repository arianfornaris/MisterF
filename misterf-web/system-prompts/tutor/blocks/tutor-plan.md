/**
 * Visible multi-step teaching plan for the current conversation.
 *
 * Use this only to start a new visible plan when a multi-step practice path
 * will help the learner understand where the session is going. Do not create a
 * plan for simple one-off answers.
 *
 * There can be only one active visible plan at a time. Do not emit this block
 * when a plan is already in progress; use `tutor_plan_update` instead. The
 * server owns the authoritative fused plan state and will re-inject it as
 * teacher-only context on later turns.
 *
 * After creating the plan, any later learner-visible claim that the plan has
 * advanced must be backed by a `tutor_plan_update` in that same response.
 */
interface TutorPlanBlock {
  /** Literal discriminator. */
  type: "tutor_plan";
  /** Short Spanish title shown in the visible plan panel. */
  title: string;
  /** Optional Spanish summary shown under the title. */
  summary?: string;
  /** Ordered visible plan steps. */
  steps: Array<{
    /** Internal stable step id; not learner-facing. */
    id: string;
    /** Short Spanish learner-facing step label. */
    label: string;
    /** Initial step status; exactly one step should be `active`. */
    status: "pending" | "active" | "done";
  }>;
}
