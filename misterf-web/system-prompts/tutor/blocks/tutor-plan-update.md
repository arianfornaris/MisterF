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
        /**
         * Existing step id from the current authoritative plan, copied
         * verbatim. Plan step ids are lowercase slugs: a letter `a`-`z`
         * followed by only `a`-`z`, `0`-`9`, `_`, or `-`.
         */
        id: string;
        /** New status for this existing step. */
        status?: "pending" | "active" | "done" | "skipped";
        /** Optional {{INSTRUCTION_LANGUAGE_NAME}} replacement label for this existing step. */
        label?: string;
      }
    | {
        /** Add a new step when a newly discovered weakness should enter the plan. */
        action: "add_step";
        /**
         * New unique internal step id. Must be a lowercase slug: it starts
         * with a letter `a`-`z` and then contains only `a`-`z`, `0`-`9`, `_`,
         * or `-` (for example `repaso_final`). Never use spaces, accents,
         * `ñ`, uppercase letters, or a leading digit.
         */
        id: string;
        /** {{INSTRUCTION_LANGUAGE_NAME}} learner-facing label for the new step. */
        label: string;
        /**
         * Existing step id after which the new step should be inserted,
         * copied verbatim from the current authoritative plan.
         */
        afterId?: string;
        /** Initial status for the new step; defaults conceptually to `pending`. */
        status?: "pending" | "active";
      }
  >;
}
