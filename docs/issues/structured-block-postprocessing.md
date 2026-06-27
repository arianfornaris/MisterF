# Structured Block Post-Processing

This document describes the structured block review layer for the tutor
runtime: the current high-confidence repair loop plus future deeper semantic
review ideas.

## Problem

The tutor response is already constrained by a structured JSON schema, but a
valid `message` block can still contain content that should have been expressed
with a specialized block.

Examples:

- a `message` that simulates a fill-in-the-blank with `___`
- a `message` that marks words with invented annotations such as `[wrong]`
- a `message` that lists multiple-choice options as plain markdown
- a `message` that mixes tutor explanation, feedback, and a new exercise

These cases are not syntax failures. They are semantic block-boundary failures:
the response is valid JSON, but the UI cannot render the pedagogical action in
the right interaction pattern.

## Goal

Keep learner-visible pedagogy inside the appropriate UI blocks instead of
letting `message` become a catch-all format.

The examples below describe the current repair intent. The authoritative
block-specific boundaries live in the tutor block protocol JSDoc, especially
`misterf-web/system-prompts/tutor/blocks/message.md`.

The desired behavior is:

- explanations, encouragement, and framing stay in `message`
- blanks use `fill_in_the_blank_input` or `fill_in_the_blank_choice`
- visible learner text corrections use `sentence_evaluation`
- open-ended writing tasks use `open_text_prompt`
- choices use `multiple_choice`
- reorder tasks use `unscramble_sentence`
- matching tasks use `matching_pairs`

## Current Architecture

The runtime uses a three-layer pipeline after the model returns blocks and before those
blocks are emitted to the client.

1. Hard validation

The current Zod schema remains the first boundary. It ensures the response is
valid JSON and uses known block shapes.

2. Semantic block lint

`blockRepair.ts` includes a lightweight local detector that scans valid blocks for suspicious patterns.
This linter should be deterministic and cheap.

Initial checks can include:

- `message` contains `___` or `{{blank}}`
- `message` contains bracketed error markers such as `[word]`
- `message` contains evaluable answer lists like `a)`, `b)`, `c)` after a
  question asking for the correct answer
- `message` contains shuffled token instructions
- `message` contains raw JSON or pseudo-block payloads such as `"parts"` with
  `status` values that look like a `sentence_evaluation`
- `message` is unusually long and appears to combine feedback plus a new task

The linter should report structured issues, not rewrite content itself.

3. Model repair

Only when the linter finds a meaningful violation, ask the model to repair the
block structure.

The repair prompt should include:

- the original blocks
- the lint findings
- the valid block schema
- the instruction to preserve the pedagogical intent while moving content to
  the correct block type

If repair still leaves detected leakage, the repair layer raises a structured
validation error. The normal tutor correction loop can then ask the model to
emit a corrected full response instead of silently accepting the original
message.

## Proposed Always-On Message Classifier

The current repair loop only runs when the local deterministic detector finds a
high-confidence issue. Recent tutor logs show that this can miss valid-looking
`message` prose that is actually a learner exercise. Examples include polite or
indirect prompts such as "¿podrías escribir una oración...?", task wording with
new verb forms, or natural Spanish phrasing that does not match the current
local patterns.

One possible next architecture is to run a second, extremely cheap classifier
inference over every tutor `message` block before repair. This classifier would
not rewrite blocks and would not tutor the learner. Its only job would be to
answer whether each `message` contains payload that should move into a typed
block.

The classifier should be optimized for cost and latency:

- use a much cheaper model than the main tutor model when available
- inspect only the current response blocks, not the full conversation history
- return compact JSON such as `no_issue` or a small list of issue objects
- include only short message excerpts and block metadata when possible
- avoid free-form explanation unless debugging is enabled
- run with low max output tokens and deterministic settings

Suggested output shape:

```json
{
  "issues": [
    {
      "blockIndex": 0,
      "kind": "open_text_prompt",
      "confidence": "high",
      "reason": "The message asks the learner to write a sentence."
    }
  ]
}
```

If the classifier returns no issues, the response can continue without repair.
If it returns high-confidence issues, the existing repair prompt can run with
those issue hints. Medium-confidence issues could be logged in debug first
before becoming repair triggers.

This would move the system from "local heuristics decide whether repair is
needed" to "local heuristics plus a cheap semantic classifier decide whether
repair is needed." The repair itself would remain a separate step so the
classifier stays small, cheap, and easy to evaluate.

Important boundaries:

- The classifier must never generate learner-visible content.
- The classifier must not decide pedagogical correctness; only block-boundary
  correctness.
- It should suggest concrete target block types such as `open_text_prompt`,
  `multiple_choice`, `fill_in_the_blank_input`, or `quiz`.
- When it cannot suggest a concrete target block, it should return `no_issue`
  or a low-confidence debug-only warning rather than triggering repair.

## Current Cost Trade-Off

Running a full repair call after every tutor response would add latency, cost,
and more failure modes. That remains undesirable.

The always-on idea above is different: it would be a cheap classifier pass, not
an always-on full repair pass. The local linter would still be useful as a fast
first signal and as a regression-tested safety net.

## Multi-Exercise Batch Issue

Another valid-JSON failure mode is a response that emits several top-level
exercise blocks in sequence, for example `message` plus three `multiple_choice`
blocks. This is not `message` leakage, but it is still a poor interaction
contract: the learner should normally handle one interactive exercise at a
time.

Preferred behavior:

- normal guided practice emits at most one top-level learner exercise block per
  tutor response
- feedback, `sentence_evaluation`, `tutor_plan`, and `tutor_plan_update` may
  accompany that one exercise when appropriate
- if several items should be answered before feedback, the tutor should emit
  one `quiz` block with multiple quiz items instead of several top-level
  exercise blocks

This issue should be tracked alongside message leakage because both are
semantic block-boundary failures that pass normal JSON validation.

## Current Prompt-Level Guard

The system prompt explicitly forbids invented inline formats inside `message`,
including:

- `___`
- `{{blank}}`
- `[word]`
- `[wrong word]`
- `[correction]`
- bracketed error markers

When Mr. F needs those interactions, he should use the specialized block
instead. If the text being reviewed is teacher-only context rather than a
visible learner message, he should explain the issue in normal prose without
fake annotations.

## Logging

The runtime keeps the original LLM output in the normal tutor logs, logs the
detected repair issues, and logs the repaired block types when repair succeeds.
This preserves enough context for debugging without storing a second full copy
of every repaired payload in normal logs.

## Open Design Questions

- Which additional violations should trigger repair and which should only warn?
- Should repeated violations become prompt examples in the system prompt?
- How should we handle `sentence_evaluation` when the source text is card state
  instead of a normal visible user message?
- Should the detector grow into a typed fixture suite with examples from logs?

## Future Rollout

1. Review block repair logs and tune false positives.
2. Add regression fixtures for common failures.
3. Promote stable lint rules into project skills and docs.
4. Consider a deeper semantic review loop for multi-block responses that are valid but pedagogically awkward.
