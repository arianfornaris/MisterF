# Structured Block Post-Processing

This document describes a future improvement for the tutor runtime: a review
loop that detects when Mr. F expresses a valid pedagogical intention in the
wrong block type.

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

The desired behavior is:

- explanations, encouragement, and framing stay in `message`
- blanks use `fill_in_the_blank_input` or `fill_in_the_blank_choice`
- visible learner text corrections use `sentence_evaluation`
- choices use `multiple_choice`
- reorder tasks use `unscramble_sentence`
- matching tasks use `matching_pairs`

## Proposed Architecture

Use a three-layer pipeline after the model returns blocks and before those
blocks are emitted to the client.

1. Hard validation

The current Zod schema remains the first boundary. It ensures the response is
valid JSON and uses known block shapes.

2. Semantic block lint

Add a lightweight local linter that scans valid blocks for suspicious patterns.
This linter should be deterministic and cheap.

Initial checks can include:

- `message` contains `___` or `{{blank}}`
- `message` contains bracketed error markers such as `[word]`
- `message` contains option lists like `a)`, `b)`, `c)` after a question
- `message` contains shuffled token instructions
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

If repair fails, the server can fall back to the original response or a safe
plain message depending on severity.

## Why Not Always Run A Second Model Call?

Running a repair call after every tutor response would add latency, cost, and
more failure modes. The second call should be conditional.

The local linter gives us a cheap signal for when a response is structurally
suspicious enough to justify repair.

## Current Prompt-Level Guard

Until this post-processing exists, the system prompt should explicitly forbid
invented inline formats inside `message`, including:

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

## Open Design Questions

- Should lint failures be logged only at first, before enabling automatic
  repair?
- Which violations should trigger repair and which should only warn?
- Should repaired responses replace the original in LLM logs, or should both be
  stored for debugging?
- Should repeated violations become prompt examples in the system prompt?
- How should we handle `sentence_evaluation` when the source text is card state
  instead of a normal visible user message?

## Suggested Rollout

1. Add lint-only logging for `message` blocks.
2. Review logs and tune false positives.
3. Enable model repair for high-confidence violations.
4. Add regression fixtures for common failures.
5. Promote stable lint rules into project skills and docs.
