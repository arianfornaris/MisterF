# Tutor Loop Prompt Audit

## Purpose

This document records a prompt/runtime audit for the Mr. F tutor loop.

The goal is to identify contradictions, bugs, and clarity problems that can make
the model less reliable when following tutor-chat rules.

This is not the source of truth for block contracts. The source of truth for
block-level behavior remains:

- `misterf-web/system-prompts/tutor/blocks/*.md`
- `misterf-web/src/server/services/llmTutor/blockProtocol.ts`

Use this document as an issue map and cleanup plan.

## Audited Areas

- `misterf-web/system-prompts/tutor/system.md`
- `misterf-web/system-prompts/tutor/blocks/*.md`
- `misterf-web/system-prompts/tutor/structured-correction.md`
- `misterf-web/system-prompts/tutor/block-repair.md`
- tutor context prompts such as `practice-module-context.md`, `chatroom-report-context.md`, `tutor-report-context.md`, and `visible-plan-context.md`
- tutor loop assembly in `src/server/services/llmTutor/prompt.ts`
- tutor loop execution in `src/server/services/llmTutor/index.ts`
- response schemas in `src/server/services/llmTutor/schemas.ts`
- block-to-history conversion in `src/server/services/llmTutor/validation.ts`
- runtime side effects in `src/server/services/tutorWorkflow/index.ts`

## Executive Summary

The tutor prompt system has grown feature by feature. The result is mostly
workable, but several layers now say similar things in different ways.

The biggest reliability risks are not just prompt wording. They are mismatches
between what the prompt tells the model, what the schema accepts, and what the
runtime actually does after accepting a response.

Highest-impact issues:

- The normal tutor response schema accepts `quiz_result`, even though the main
  tutor protocol should not allow Mr. F to emit it directly.
- `sentence_evaluation` claims it can evaluate earlier learner messages, but the
  runtime attaches its metadata to the latest user message only.
- Context prompts with "start by" language are re-injected on every turn, which
  can make a continuing conversation behave like a new one.
- The tutor history loses structured block information because blocks are
  converted to simplified markdown before being sent back to the model.
- The main system prompt uses "plan" both for internal pedagogical strategy and
  visible `tutor_plan`, which can blur two different concepts.

## High-Impact Findings

### `quiz_result` Is Accepted By The Tutor Schema

Current state:

- `system-prompts/tutor/blocks/tutor-response-block.md` does not include
  `quiz_result`.
- `system-prompts/tutor/system.md` does not ask the normal tutor to emit
  `quiz_result`.
- `src/server/services/llmTutor/schemas.ts` includes `quizResultBlockSchema` in
  `tutorResponseSchema`.

Why this is a problem:

- The prompt contract says the main tutor should not emit `quiz_result`.
- The runtime validation still accepts it.
- A model that invents or repeats a `quiz_result` block could pass validation
  even though that block should only be produced by the quiz completion flow.

Recommended fix:

- Split the schema into two concepts:
  - `tutorAgentResponseSchema` for blocks the normal tutor may emit.
  - `persistedTutorBlockSchema` or equivalent for blocks the app may store and
    render historically, including `quiz_result`.
- Keep `quiz_result` out of `tutor-response-block.md` unless the product
  intentionally changes so the main tutor can emit quiz results directly.

### `sentence_evaluation` Can Point To The Wrong Message

Current state:

- `system-prompts/tutor/blocks/sentence-evaluation.md` says the block may
  evaluate the latest answer or an earlier learner message.
- `src/server/services/tutorWorkflow/index.ts` applies
  `sentence_evaluation` metadata to `lastUserMessageId`.

Why this is a problem:

- The prompt allows a broader behavior than the runtime supports.
- If the model evaluates an earlier long message, the UI metadata can attach to
  the latest learner message instead.
- This matches the observed symptom where editing/reviewing a
  `sentence_evaluation` can show text that does not correspond to the evaluated
  block.

Recommended fix options:

- Minimal: change the prompt to say `sentence_evaluation` only applies to the
  latest visible learner message until source ids are supported.
- Better: add explicit source metadata to `sentence_evaluation`, such as
  `sourceMessageId` or a server-resolved source reference, and validate it.
- If evaluating arbitrary previous text remains important, the server must not
  blindly attach metadata to `lastUserMessageId`.

### Context Prompts Say "Start" But Are Reused Every Turn

Current state:

- `tutor-report-context.md` says: "Start by briefly acknowledging..."
- `chatroom-report-context.md` says: "Start practicing immediately..."
- These context prompts are appended by `buildAgentSystemInstruction(...)` every
  time the tutor loop runs for conversations that carry those snapshots.

Why this is a problem:

- These prompts describe first-turn behavior, but they are injected as ongoing
  context.
- The model may repeatedly restart, re-acknowledge the source report, or begin a
  new exercise instead of continuing naturally.

Recommended fix:

- Separate persistent teacher-only context from first-turn nudge.
- Persistent context should say: "Use this report as background when choosing
  practice."
- First-turn behavior should be sent as an extra user/internal message only when
  creating the new conversation.

### Structured Blocks Lose Information In History

Current state:

- `blocksToMarkdown(...)` converts accepted blocks into plain text for persisted
  message content.
- Later turns send `message.content` back to the model.
- Some conversions are lossy:
  - `sentence_evaluation` becomes only "Revisemos esta parte:"
  - `multiple_choice` may only preserve `prompt` or `question`, not all options
  - `matching_pairs` may only preserve the prompt, not the pairs
  - `unscramble_sentence` may expose the ordered answer as plain text

Why this is a problem:

- The model cannot reliably know what structured task it gave before.
- The model may repeat tasks, mis-evaluate follow-ups, or lose track of the
  current exercise.
- The transcript seen by the model differs from what the user saw in the UI.

Recommended fix:

- Persist structured blocks in metadata as already done, but also convert them
  back into a faithful model-facing representation when building history.
- Consider a compact internal transcript format, for example:

```text
ASSISTANT_BLOCKS:
- type: multiple_choice
  prompt: ...
  question: ...
  options: [...]
```

- Keep this representation teacher-only and never learner-visible.

### "Plan" Means Two Different Things

Current state:

- `system.md` tells the model to maintain an internal dynamic pedagogical plan.
- The app also has visible `tutor_plan` and `tutor_plan_update` blocks.

Why this is a problem:

- The model may confuse ordinary pedagogical direction with the visible plan UI.
- It can over-create `tutor_plan`, or narrate plan progress without emitting
  `tutor_plan_update`.

Recommended fix:

- Rename the internal concept in the prompt to something like:
  - "teaching hypothesis"
  - "pedagogical direction"
  - "working diagnosis"
- Reserve "visible plan" for `tutor_plan` and `tutor_plan_update`.

## Prompt Clarity Issues

### Block Names Are Forbidden Without A Learner-Visible Qualifier

Current state:

- `system.md` says never mention labels such as `message`,
  `translate_to_english_prompt`, `sentence_evaluation`, etc.

Why this is confusing:

- The model must use those exact labels in JSON.
- The real requirement is that block names must not appear in learner-visible
  fields.

Recommended wording:

- "Use protocol labels only as JSON discriminators. Never mention protocol
  labels in learner-visible text such as `message.markdown`, prompts, titles,
  labels, or explanations."

### Block Separation Rule Is Too Repetitive

Current state:

- `system.md` has a long high-priority block separation section.
- `message.md` and individual block files also document block boundaries.
- `structured-correction.md` and `block-repair.md` repeat some of the same rules.

Why this is a problem:

- The intent is correct, but repeated instructions increase prompt weight and
  make it harder to know which wording is authoritative.
- Changes in one layer can drift from the others.

Recommended fix:

- Keep a shorter global rule in `system.md`.
- Keep exact block-specific rules in `tutor/blocks/*.md`.
- Keep correction/repair prompts focused on the current repair task and the
  injected protocol.

### Lettered Navigation Choices Need A Sharper Boundary

Current state:

- `system.md` asks the tutor to use `a)`, `b)`, `c)` when offering learner
  choices about how to continue.
- The block separation rule forbids fake multiple-choice exercises inside
  `message`.
- The repair detector watches for multiple-choice-like text in `message`.

Why this is a problem:

- The model can confuse navigation options with answer options.
- The repair layer can also be forced to distinguish a subtle intent.

Recommended fix:

- Make the allowed case explicit:
  - Lettered lists in `message` are only for navigation choices with no hidden
    correct answer.
  - If there is a correct answer, use `multiple_choice`.

### `start-session.md` Is Too Weak

Current state:

- `start-session.md` only says: "Start the session."

Why this is a problem:

- It does not reinforce the desired first-turn behavior.
- It can lead to generic greetings, broad questions, or weak agenda setting.

Recommended fix:

- Replace it with a concise first-turn nudge:
  - greet briefly in Spanish
  - do not ask many setup questions
  - start with a useful diagnostic micro-practice when no topic is known
  - if the learner already gave a topic, start directly there

## Correction And Repair Prompt Issues

### `structured-correction.md` Duplicates The Valid Block List

Current state:

- `structured-correction.md` contains a manually written list of valid block
  types.
- `blockProtocol.ts` already owns the protocol composition.

Why this is a problem:

- It can drift when blocks are added or removed.
- It creates another place to update manually.

Recommended fix:

- Generate the valid block list from `tutorBlockProtocolNames`, or remove the
  manual list and rely on the injected `BLOCK_PROTOCOL`.

### `block-repair.md` Says To Return Original Blocks If No Repair Is Possible

Current state:

- `block-repair.md` says: "If no safe repair is possible, return the original
  blocks unchanged."
- `blockRepair.ts` re-detects leakage and throws after repeated unresolved
  issues.

Why this is probably acceptable:

- The runtime protects against unresolved leakage.

Why it may still confuse the repair model:

- It may encourage the model to give up rather than attempt a conservative
  structural split.

Recommended fix:

- Keep the fallback, but make the priority sharper:
  - "Prefer a conservative valid typed split. Only return original blocks if the
    detected issue is a false positive or impossible to repair without
    inventing content."

## Tool Prompt And System Prompt Interaction

### Tool Descriptions Are Stronger Than The System Prompt In Some Places

Current state:

- Practice-module, chat-room, and progress tools have detailed descriptions.
- `system.md` also repeats many tool-use rules.

Why this is mostly good:

- The tool descriptions prevent misuse close to the tool call decision.

Risk:

- Some rules are duplicated in both locations, so future edits can drift.

Recommended fix:

- Keep high-level tool families and boundaries in `system.md`.
- Keep exact use/omit rules in tool descriptions.
- When changing a tool's purpose, update `docs/architecture/architecture.md`,
  `docs/tutor/runtime.md`, and the tool description together.

## Recommended Cleanup Order

### Phase 1: Fix Contract/Runtime Mismatches

- Split normal tutor response schema from persisted/renderable block schema.
- Remove `quiz_result` from the normal tutor response validator.
- Resolve `sentence_evaluation` source behavior:
  - either restrict it to the latest learner message
  - or add explicit source references and runtime support.
- Stop reusing first-turn "start by" instructions as persistent context.

### Phase 2: Improve Model-Facing History

- Replace lossy `blocksToMarkdown(...)` history with a faithful compact
  model-facing representation of structured blocks.
- Keep learner-visible content separate from teacher-only block summaries.
- Preserve enough data for the model to know what exercise, options, pairs,
  tokens, or evaluation it previously emitted.

### Phase 3: Simplify And De-duplicate Prompts

- Shorten the block separation section in `system.md`.
- Move exact block rules into `tutor/blocks/*.md`.
- Clarify that protocol labels are forbidden only in learner-visible text.
- Replace internal "plan" wording with "teaching hypothesis" or similar.
- Strengthen `start-session.md`.
- Remove or generate manual valid-block lists from correction prompts.

### Phase 4: Add Regression Fixtures

- Add fixture tests for:
  - `message` leaking blanks
  - `message` leaking multiple-choice answer options
  - `message` leaking raw JSON/sentence evaluation payloads
  - `sentence_evaluation` source-message behavior
  - normal tutor attempts to emit `quiz_result`
  - first-turn context prompts not repeating on later turns

## Design Direction

The right long-term direction is not to add more defensive prompt text.

The healthier design is:

- one clear protocol source
- one normal tutor response schema
- separate persisted/rendered block schema when needed
- faithful model-facing history
- small context prompts with clear lifetime: first-turn only vs persistent
- exact block documentation beside each block interface

That structure should reduce prompt bloat and make Mr. F more reliable without
requiring increasingly strict or repetitive prose.
