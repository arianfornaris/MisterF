# Tutor Visible Plans

## Goal

Mr. F should be able to create and follow a visible teaching plan during a
tutor conversation.

The plan is not an agent-style TODO that the model completes by itself. It is a
shared pedagogical checklist that helps the learner see where the practice is
going and helps the tutor stay on track across turns.

The plan should appear near the message composer, not as a normal chat bubble,
so it remains visible while the learner works through the current step.

## Product Behavior

- A conversation can have at most one active tutor plan at a time.
- The plan is visible to the learner.
- The learner can see the current step, completed steps, and upcoming steps.
- The learner can minimize or expand the plan UI.
- The learner can conclude the plan from the UI.
- If all steps are complete, concluding the plan removes it immediately.
- If steps remain incomplete, concluding the plan shows a confirmation modal.
- The learner cannot edit or skip individual steps yet.
- The tutor may update the plan as the learner succeeds, struggles, changes
  topic, or asks for a different direction.
- The tutor must update the plan in the same response where it tells the
  learner that a step was completed, skipped, changed, or advanced.
- The server, not the model, owns the authoritative fused plan state.
- The current fused plan must be re-injected into the tutor context on every
  turn so the model never has to reconstruct state from old `tutor_plan` and
  `tutor_plan_update` blocks scattered through the transcript.

## Structured Blocks

The tutor can emit two plan-related response blocks.

### `tutor_plan`

Creates the current visible plan for the conversation.

```ts
interface TutorPlanBlock {
  type: "tutor_plan";
  title: string;
  summary?: string;
  steps: Array<{
    id: string;
    label: string;
    status: "pending" | "active" | "done";
  }>;
}
```

Expected rules:

- `title` must be Spanish.
- `summary` must be Spanish when present.
- `label` must be Spanish.
- `id` must be stable, short, unique inside the plan, and not learner-facing.
- Exactly one step should be `active` while the plan is in progress.
- `tutor_plan` is for starting a plan, not for routine updates.
- If an active plan already exists, a new `tutor_plan` is rejected.
- If the previous plan is complete, a new `tutor_plan` may start a new plan.
- If full reset/replacement is later allowed, the server must preserve status
  for matching step ids unless the learner explicitly asked to restart the plan.
- The model should create a new plan only when a multi-step teaching path is
  useful, not for every single question.

### `tutor_plan_update`

Applies operations to the existing plan.

```ts
interface TutorPlanUpdateBlock {
  type: "tutor_plan_update";
  operations: Array<
    | {
        action: "update_step";
        id: string;
        status?: "pending" | "active" | "done" | "skipped";
        label?: string;
      }
    | {
        action: "add_step";
        id: string;
        label: string;
        afterId?: string;
        status?: "pending" | "active";
      }
  >;
}
```

Expected rules:

- `update_step.id` must match an existing step in the current plan.
- `add_step.id` must be new and unique inside the plan.
- `add_step.afterId`, when present, must match an existing step id.
- `add_step` appends to the end of the plan when `afterId` is omitted.
- `label`, when present, must be Spanish.
- `update_step.label` is optional and should only be used when renaming or
  clarifying an existing step.
- `add_step.label` is required and must be Spanish.
- `update_step` must not create new steps.
- `add_step` must not rewrite existing steps.
- After applying all operations, there must be at most one `active` step.
- If all steps are `done` or `skipped`, the plan is considered complete.

This design lets the tutor adapt the plan when a new weakness appears without
replacing the whole plan or losing progress.

## Server Validation

Shape validation should live in the normal tutor block schema.

Contextual validation should happen after schema validation because it requires
the current conversation plan:

- Reject `tutor_plan_update` when there is no active plan.
- Reject `update_step` if its `id` does not exist in the current plan.
- Reject `add_step` if its `id` already exists in the current plan.
- Reject `add_step` if `afterId` is provided and does not exist.
- Reject duplicate step ids in `tutor_plan`.
- Reject multiple `active` steps in a resulting plan state.
- Reject invalid state transitions if we decide to enforce them.
- Reject `tutor_plan` when an active plan already exists.
- Reject more than one plan mutation block in the same assistant response unless
  a clear ordering rule has been implemented.

Rejected contextual updates go through the same structured correction loop used
for invalid tutor blocks, so the model can repair the response.

## Persistence

The current tutor plan is stored as conversation-level state, not only in
message metadata.

Recommended persisted shape:

```ts
interface StoredTutorPlan {
  conversationId: string;
  title: string;
  summary?: string;
  steps: Array<{
    id: string;
    label: string;
    status: "pending" | "active" | "done" | "skipped";
  }>;
  createdAt: string;
  updatedAt: string;
}
```

This lets the UI restore the plan after refresh and lets future server flows
reason about the current pedagogical step.

## Authoritative Plan Context

The stored plan is the source of truth.

Before every tutor turn, the server injects the current fused `StoredTutorPlan`
into the model context as teacher-only state, similar to how conversation
reports and other internal reports are supplied.

Example teacher-only context:

```text
Current visible teaching plan:
- title: Práctica de conversación en aeropuerto
- active step: questions
- steps:
  - vocab: done — Repasar vocabulario clave
  - questions: active — Practicar preguntas con would
  - dialogue: pending — Hacer una mini conversación
```

The model should treat this injected plan as authoritative. It should not try
to reconstruct the current plan by mentally merging older `tutor_plan` and
`tutor_plan_update` blocks from the chat history.

This is the key reliability mechanism: the model reads the already-fused truth
from the database instead of deriving state from scattered transcript fragments.

## Runtime Flow

1. Before the tutor turn, the server loads the current fused `StoredTutorPlan`
   from the conversation, if one exists.
2. The server injects that plan into the model context as teacher-only
   authoritative state.
3. The tutor emits `tutor_plan` when it wants to start a visible multi-step
   teaching path.
4. The server validates the plan shape and plan invariants.
5. The server stores the plan on the conversation.
6. The client receives the assistant response and updates the visible plan UI.
7. On later turns, the tutor emits `tutor_plan_update` when progress changes.
8. If the tutor tells the learner that progress changed, that same response
   must include the matching `tutor_plan_update`.
9. The server validates the update against the stored plan.
10. The server applies update operations to produce a new fused plan state.
11. The server persists the fused plan and sends it to the client.
12. On the next turn, the server injects that fused plan back into the model
    context.

The plan blocks should not render as ordinary message bubbles. They should be
handled as side-effect blocks with visible client state.

## UI

Render the active plan near the composer so it stays visible while the learner
responds.

Desktop layout:

- A compact Bootstrap card or panel above the composer.
- Title and optional summary at the top.
- Steps shown as a small vertical checklist.
- Current step highlighted with Bootstrap theme styles.

Mobile layout:

- The same plan can be minimized to a compact summary.
- The minimized view shows the current step using the same step visual language
  as the expanded plan.
- The minimized view exposes controls to expand or conclude the plan.

Initial status rendering:

- `done`: checkmark icon and muted/completed style.
- `active`: current-step highlight.
- `pending`: neutral upcoming style.
- `skipped`: muted skipped style.

The close/conclude and minimize controls are icon-only buttons without custom
backgrounds. They should feel like standard lightweight Bootstrap UI controls,
similar in spirit to modal close buttons. `Saltar paso` has not been
implemented yet.

## Prompt Guidance

The tutor prompt documents both blocks in the structured response
protocol, next to their TypeScript-like definitions.

Important model instructions:

- Use a visible plan only when it helps the learner understand a multi-step
  practice path.
- Keep plan step labels short and learner-friendly.
- Do not expose internal reasoning in the plan.
- Do not create a plan for simple one-off answers.
- Use `tutor_plan_update` to advance, skip, rename, or append steps.
- If the visible message says or implies that the plan advanced, include the
  matching `tutor_plan_update` in the same response.
- When activating a new step, mark the old active step `done` or `skipped` and
  mark the next step `active` in the same operation list.
- Use `update_step` only for existing step ids.
- Use `add_step` when a newly discovered weakness should become part of the
  plan.
- Do not update a step id that does not exist.
- Do not re-emit `tutor_plan` just to make a normal adjustment.
- Do not keep advancing the plan if the learner has not satisfied the active
  step.

## Future Extensions

- Learner can skip the active step.
- Learner can ask Mr. F to revise the plan.
- Plan state can inform progress summaries.
- Plan steps can be used as future practice-guide seeds.
- The tutor can use learner progress data when creating the initial plan.
