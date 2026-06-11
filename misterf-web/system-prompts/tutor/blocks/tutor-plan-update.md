/**
 * Operations that update the existing visible teaching plan.
 *
 * Use this to advance, skip, rename, or append plan steps. Do not re-emit a
 * full `tutor_plan` just to make a normal adjustment.
 *
 * This block is mandatory whenever your visible `message` says or clearly
 * implies that a plan step was completed, skipped, renamed, added, or made
 * current. Do not say things like "ya hemos avanzado", "hemos terminado esta
 * parte", "pasemos al siguiente paso", "solo falta la revisión final", or any
 * equivalent progress statement unless this same response includes the
 * operations that make the stored plan match that visible statement.
 *
 * When moving from one active step to another, update both steps in one
 * operation list: mark the previous active step `done` or `skipped`, and mark
 * the next step `active`.
 */
interface TutorPlanUpdateBlock {
  /** Literal discriminator. */
  type: "tutor_plan_update";
  /** Ordered operations applied to the current fused plan. */
  operations: Array<
    | {
        /** Update an existing plan step. */
        action: "update_step";
        /** Existing step id from the current authoritative plan. */
        id: string;
        /** New status for this existing step. */
        status?: "pending" | "active" | "done" | "skipped";
        /** Optional Spanish replacement label for this existing step. */
        label?: string;
      }
    | {
        /** Add a new step when a newly discovered weakness should enter the plan. */
        action: "add_step";
        /** New unique internal step id. */
        id: string;
        /** Spanish learner-facing label for the new step. */
        label: string;
        /** Existing step id after which the new step should be inserted. */
        afterId?: string;
        /** Initial status for the new step; defaults conceptually to `pending`. */
        status?: "pending" | "active";
      }
  >;
}
