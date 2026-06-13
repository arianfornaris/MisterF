# Tutor Loop Remediation Tracker

## Purpose

This document tracks the remediation plan for the tutor-loop prompt/runtime
issues documented in:

- [Tutor Loop Prompt Audit](./tutor-loop-prompt-audit.md)

Use this document as both:

- a solution design map
- a living implementation tracker

Whenever one of these issues is fixed, update its status and add a short entry
to the implementation log.

## Status Legend

- `not_started`: no implementation work has begun
- `in_progress`: implementation has started but is not complete
- `implemented`: code/prompt/docs changes are in place
- `verified`: implementation has been tested or manually verified
- `deferred`: intentionally postponed
- `rejected`: intentionally not doing this solution

## Remediation Principles

- Prefer structure over defensive prompt bloat.
- Keep `tutor/blocks/*.md` as the source of truth for block contracts.
- Keep learner-visible content rules close to the relevant block interface.
- Keep prompt lifetime explicit: first-turn-only prompts must not become
  persistent context.
- Make schemas match the model-facing contract exactly.
- Preserve structured state for the model instead of forcing it to reconstruct
  UI history from lossy prose.

## Tracker

| ID | Issue | Status | Primary Files | Target Outcome |
| --- | --- | --- | --- | --- |
| `TLR-001` | `quiz_result` is accepted by the normal tutor response schema | `implemented` | `schemas.ts`, `types.ts`, `validation.ts`, `blockRepair.ts`, `index.ts` | Normal tutor responses cannot emit `quiz_result`; persisted/renderable history still can |
| `TLR-002` | `sentence_evaluation` can claim to evaluate earlier messages, but runtime attaches it to latest user message | `implemented` | `sentence-evaluation.md`, `tutorWorkflow/index.ts`, chat client renderer/socket files | `sentence_evaluation` renders only as a standalone tutor block and no longer attaches metadata to user messages |
| `TLR-003` | First-turn context prompts are re-injected every turn | `implemented` | `chatSocket.ts`, `tutor-report-context.md`, `chatroom-report-context.md`, report start prompts | Persistent context no longer contains "start by" behavior; first-turn nudges run only once |
| `TLR-004` | Structured blocks are converted to lossy markdown before returning to the model as history | `implemented` | `chatSocket.ts` | Model-facing history sends the final accepted/repaired `{ blocks: [...] }` JSON when stored blocks exist |
| `TLR-005` | The word "plan" means both internal teaching direction and visible `tutor_plan` | `implemented` | `system.md` | Internal strategy is renamed to avoid confusing it with visible plans |
| `TLR-006` | Protocol labels are forbidden without clarifying learner-visible scope | `implemented` | `system.md` | Model may use protocol labels in JSON but not in learner-visible text |
| `TLR-007` | Block separation rules are repeated across too many prompt layers | `implemented` | `system.md`, `tutor/blocks/*.md`, `structured-correction.md`, `block-repair.md` | Global prompt is shorter; exact block rules remain in JSDoc-style protocol files |
| `TLR-008` | Lettered navigation choices can be confused with multiple-choice exercises | `implemented` | `system.md`, `message.md`, schemas/renderers | Optional navigation choices use short `a)`, `b)`, `c)` lists in `message`; evaluable choices still require typed exercise blocks |
| `TLR-009` | `start-session.md` is too weak | `not_started` | `start-session.md` | First turn nudges Mr. F toward concise greeting plus useful diagnostic practice |
| `TLR-010` | `structured-correction.md` manually duplicates the valid block list | `implemented` | `structured-correction.md` | Valid block list is removed in favor of the injected protocol |
| `TLR-011` | `block-repair.md` fallback can encourage returning unresolved original blocks | `implemented` | `block-repair.md` | Repair prompt prefers conservative typed repair and only returns original blocks for false positives/impossible repairs |
| `TLR-012` | Tool-use rules are duplicated between `system.md` and tool descriptions | `implemented` | `system.md`, `chatRoomTools.ts` | System prompt keeps high-level boundaries; exact use/omit rules live in tool descriptions |
| `TLR-013` | No regression fixtures protect prompt/runtime behavior | `not_started` | test files to be created | Common tutor-loop failure patterns are covered by tests or repeatable fixtures |

## Detailed Solution Plan

### `TLR-001`: Separate Normal Tutor Response Schema From Persisted Blocks

Problem:

- `quiz_result` is a server-generated quiz evaluation block.
- The normal tutor protocol does not include it.
- The current `tutorResponseSchema` still accepts it.

Solution:

- Create a model-facing schema for normal tutor output, for example
  `tutorAgentResponseSchema`.
- Keep `quiz_result` only in a persisted/renderable block schema.
- Ensure `validateTutorResponseBlocks(...)` uses the normal tutor schema for
  model output.
- Keep rendering/history code able to handle persisted `quiz_result` messages.

Acceptance criteria:

- A normal tutor response containing `quiz_result` fails validation.
- Quiz completion still stores and renders `quiz_result`.
- Docs and the `tutor-protocol-jsdoc` skill remain aligned.

### `TLR-002`: Fix `sentence_evaluation` Source Binding

Problem:

- The prompt says `sentence_evaluation` may evaluate earlier learner messages.
- The runtime applies metadata to `lastUserMessageId`.

Selected solution:

- Keep `sentence_evaluation` as a standalone tutor block.
- Do not add message ids or `sourceMessageId` yet.
- Do not attach sentence evaluations to user-message metadata.
- Render the block directly from the tutor message's own `metadata.blocks`.
- Let the "Editar texto" action use `sentence_evaluation.sourceText`, with old
  stored blocks falling back to reconstructing from `parts`.
- Revisit explicit source references only if the product later needs true
  message-level annotations.

Acceptance criteria:

- Prompt and runtime agree that `sentence_evaluation` does not attach metadata
  to learner messages.
- New tutor responses containing `sentence_evaluation` render the evaluation
  card directly from the tutor block.
- Editing/reviewing a sentence evaluation no longer points to unrelated latest
  user text.
- `sentence_evaluation.parts` covers the complete `sourceText` rather than only
  the problem fragments.

### `TLR-003`: Split Persistent Context From First-Turn Nudge

Problem:

- `tutor-report-context.md` and `chatroom-report-context.md` contain first-turn
  language but are included in every tutor turn for those conversations.

Solution:

- Rewrite persistent context prompts so they only provide background.
- Move "start by..." behavior into one-time internal user messages when a
  conversation is created from a report.
- Keep the same report data available across turns without restarting behavior.
- Report-based conversations now use:
  - persistent system context for the report-backed conversation objective
  - `tutor-report-start.md` or `chatroom-report-start.md` as one-shot internal
    first-turn nudges
- The one-shot nudge is injected only when the report-seeded conversation has no
  persisted messages yet.

Acceptance criteria:

- Later turns in report-seeded conversations do not repeatedly behave like the
  first turn.
- First turn still starts practice quickly when the conversation is created.

### `TLR-004`: Preserve Structured Blocks In Model-Facing History

Problem:

- The tutor sees simplified markdown, not the structured blocks the user saw.

Solution:

- Keep the final accepted/repaired tutor response blocks as the model-facing
  history.
- For persisted assistant messages with `metadata.blocks`, send the previous
  assistant message back to the model as:

```json
{
  "blocks": []
}
```

- Do not invent a separate canonical history format.
- Do not send rejected invalid JSON. Rejected outputs are not persisted.
- If a raw output is repaired from `A` into `B, C`, only the final repaired
  `B, C` blocks are persisted and returned to the model.
- Keep the stored user-visible `content` unchanged.
- Fall back to stored markdown only for older/fallback assistant messages without
  `metadata.blocks`.

Acceptance criteria:

- The model can see the exact final structured blocks from prior tutor messages
  in later turns.
- No learner-visible UI changes are required.
- Existing conversations without block metadata still fall back to stored
  markdown.

### `TLR-005`: Rename Internal Pedagogical "Plan"

Problem:

- The prompt uses "plan" for internal teaching strategy and for visible
  `tutor_plan`.

Solution:

- In `system.md`, replace internal "plan" wording with "working diagnosis",
  "teaching hypothesis", or "pedagogical direction".
- Reserve "visible plan" for the UI-backed `tutor_plan` blocks.
- Keep `tutor_plan` and `tutor_plan_update` as the protocol names for the
  visible plan UI.
- Do not use plain "plan" for the tutor's private adaptive reasoning. Use
  "internal teaching hypothesis" or "pedagogical direction" instead.

Acceptance criteria:

- The prompt clearly distinguishes internal adaptive judgment from visible plan
  blocks.
- The model is less likely to emit `tutor_plan` just because it is maintaining
  an internal teaching direction.

### `TLR-006`: Clarify Protocol Label Scope

Problem:

- `system.md` says never mention protocol labels, but the model must output them
  in JSON.

Solution:

- Replace the broad prohibition with:
  - protocol labels are required inside JSON discriminators
  - protocol labels must never appear in learner-visible text fields
- Learner-visible text fields include `message.markdown`, prompts, titles,
  labels, options, and explanations.

Acceptance criteria:

- The instruction no longer contradicts JSON generation.
- Learner-visible text still hides implementation details.

### `TLR-007`: De-Duplicate Block Separation Prompting

Problem:

- Block separation rules appear globally, in block docs, and in repair prompts.

Solution:

- Keep a concise global rule in `system.md`.
- Keep exact block-specific boundaries in `tutor/blocks/*.md`.
- Keep correction/repair prompts task-specific and driven by injected protocol.
- `MessageBlock` carries the detailed "do not simulate typed blocks in
  markdown" rules because that is the contract most directly involved in block
  leakage.

Acceptance criteria:

- `system.md` is shorter and easier to scan.
- No block-specific rule is lost; each lives beside its interface.
- Repair prompts still have enough instruction to fix misplaced payloads.

### `TLR-008`: Clarify Lettered Navigation Choices

Problem:

- Lettered lists can be valid navigation choices or invalid fake
  multiple-choice exercises.

Selected solution:

- Keep optional navigation choices as short lettered lists inside `message`.
- Allow this only when the options have no correct/incorrect outcome and simply
  offer possible next directions.
- Do not use `multiple_choice`, `quiz`, or another evaluable block for optional
  navigation choices.
- Any evaluable choice with correct answers must still use `multiple_choice` or
  `quiz`.

Acceptance criteria:

- The model can offer user navigation options without simulating exercises.
- Repair detection does not convert optional direction lists into evaluable
  blocks.
- Optional direction lists cannot carry `isCorrect` or any answer key.

### `TLR-009`: Strengthen `start-session.md`

Problem:

- The prompt only says "Start the session."

Solution:

- Replace it with a concise first-turn instruction:
  - speak in Spanish
  - greet briefly
  - avoid too many setup questions
  - if the user already gave a topic, start there
  - otherwise begin with a small diagnostic practice prompt

Acceptance criteria:

- New conversations start with a useful, concise tutor move.
- Mr. F does not default to broad setup menus.

### `TLR-010`: Remove Manual Block List Drift In Correction Prompt

Problem:

- `structured-correction.md` manually lists valid blocks.

Solution:

- Remove the manual list and rely on `BLOCK_PROTOCOL`.

Acceptance criteria:

- Adding/removing valid blocks requires updating one protocol source.
- Structured correction cannot drift from the main protocol.

### `TLR-011`: Sharpen Block Repair Fallback

Problem:

- `block-repair.md` says to return original blocks if no safe repair is
  possible.

Solution:

- Reword fallback:
  - prefer conservative typed repair
  - return original blocks only when the detector is a false positive or repair
    would require inventing content

Acceptance criteria:

- The repair model is not encouraged to give up on repairable leakage.
- False positives can still be preserved safely.

### `TLR-012`: Reduce Tool Rule Duplication

Problem:

- Tool-use policy is repeated in `system.md` and tool descriptions.

Solution:

- Keep `system.md` focused on broad categories:
  - normal tutoring vs persistent resource administration
  - tools require explicit user intent
  - use tool results, never invented ids
- Keep precise use/omit rules inside tool descriptions.

Acceptance criteria:

- Tool-use behavior remains guarded.
- Future tool wording changes have fewer duplicated prompt sections to update.
- The system prompt describes broad tool boundaries while exact use/omit rules,
  parameter requirements, and id rules live in tool descriptions.

### `TLR-013`: Add Regression Fixtures

Problem:

- Prompt/runtime behavior is mostly protected by live observation, not repeatable
  fixtures.

Solution:

- Add tests or scripted fixtures for:
  - `message` leaking blanks
  - `message` leaking answer options
  - `message` leaking raw `sentence_evaluation` JSON
  - normal tutor output attempting `quiz_result`
  - `sentence_evaluation` source behavior
  - first-turn report context not repeating later

Acceptance criteria:

- Regressions can be caught without manually inspecting logs.
- Prompt cleanup can proceed with less fear of breaking behavior silently.

## Implementation Log

| Date | Entry | Status Change | Notes | Verification |
| --- | --- | --- | --- | --- |
| 2026-06-12 | Created remediation tracker | all issues initialized as `not_started` | Tracker created from `docs/issues/tutor-loop-prompt-audit.md` findings | Documentation-only change |
| 2026-06-12 | Implemented `TLR-001` normal vs persisted tutor block schemas | `TLR-001`: `not_started` -> `implemented` | Added `tutorAgentResponseSchema` without `quiz_result`, kept `persistedTutorResponseSchema` with `quiz_result`, and typed normal tutor output as `TutorAgentResponseBlock` | `npm run typecheck`; schema smoke tests; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-002` standalone sentence evaluations | `TLR-002`: `not_started` -> `implemented` | Removed the runtime side effect that wrote `metadata.sentenceEvaluation`, removed the client pending-evaluation path, and documented the block as standalone | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-003` report first-turn split | `TLR-003`: `not_started` -> `implemented` | Persistent report contexts now describe the conversation objective without start commands; report-start prompts are injected once via `extraHistory` for empty report conversations | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-004` simple structured history | `TLR-004`: `not_started` -> `implemented` | Assistant messages with `metadata.blocks` now return the final accepted/repaired `{ blocks: [...] }` JSON to the model history; removed the over-designed solution doc | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-005` internal plan wording cleanup | `TLR-005`: `not_started` -> `implemented` | Replaced ambiguous internal "plan" wording in `system.md` with "internal teaching hypothesis" and "pedagogical direction"; kept `tutor_plan` for the visible UI plan | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-006` protocol label scope clarification | `TLR-006`: `not_started` -> `implemented` | Clarified that protocol labels are required in JSON discriminators but forbidden in learner-visible text fields | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-007` block separation prompt de-duplication | `TLR-007`: `not_started` -> `implemented` | Shortened the global block separation rule, moved detailed `message` boundaries into `MessageBlock` JSDoc, and made correction/repair prompts defer to the injected protocol | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-010` manual block list removal | `TLR-010`: `not_started` -> `implemented` | Removed the hand-written valid block type list from `structured-correction.md`; the correction prompt now relies on the injected `TutorResponseBlock` contract | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-011` sharper block repair fallback | `TLR-011`: `not_started` -> `implemented` | Reworded `block-repair.md` to prefer conservative typed repair and preserve originals only for false positives or repairs that would require inventing missing content | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Implemented `TLR-012` tool rule de-duplication | `TLR-012`: `not_started` -> `implemented` | Reduced tool policy in `system.md` to high-level boundaries and reinforced `list_chat_rooms` so explicit-use policy lives in the tool description | `npm run typecheck`; `npm run pm2:restart` |
| 2026-06-12 | Tried `TLR-008` with a dedicated direction block | `TLR-008`: `not_started` -> `implemented` | Added a non-evaluable direction block as an intermediate solution with Bootstrap list-group rendering | `npm run typecheck`; schema smoke test; `npm run pm2:restart` |
| 2026-06-13 | Simplified `TLR-008` back to lettered direction lists | `TLR-008`: `implemented` | Removed the dedicated direction block from the tutor protocol/client, allowed optional `a)`, `b)`, `c)` navigation lists in `message`, and kept evaluable choices restricted to typed exercise blocks | `npm run typecheck`; `npm run pm2:restart` |

## How To Update This Tracker

When implementing a fix:

- Change the relevant tracker row status.
- Add a short implementation log entry.
- Link or mention the main files changed.
- Add verification notes, even if verification is manual.
- If the selected solution changes, update the detailed solution section rather
  than leaving stale guidance behind.

Example log entry:

```md
| 2026-06-12 | Implemented `TLR-000` example fix | `TLR-000`: `implemented` | Updated the relevant prompt/runtime files | Manual verification notes |
```
