---
name: system-prompt-coherence
description: Use when creating, editing, reviewing, or debugging any LLM system prompt, prompt fragment, repair prompt, correction prompt, tool-use prompt, or multi-file prompt loop in Mister F. Requires reviewing the prompt as a whole so local prompt edits do not introduce contradictions, regressions, duplicated rules, or confusing instructions for the model.
---

# System Prompt Coherence

Use this skill whenever a change affects an LLM loop's instructions, not just
when editing a file named `system.md`.

## Core Rule

Never treat a prompt edit as an isolated line change. Prompt behavior comes from
the full assembled instruction set: base system prompt, injected protocol,
context prompts, repair/correction prompts, tool descriptions, and runtime
messages. Review the loop as the model sees it.

## Workflow

1. Identify the exact loop being changed: tutor chat, block repair, structured
   correction, quiz evaluation, report generation, resource draft generation,
   chat-room generation, progress update, or another LLM call.
2. Locate every prompt or model-facing instruction used by that loop, including:
   `system-prompts/**`, composed block protocols, tool descriptions,
   teacher-only context envelopes, runtime continuation prompts, and injected
   one-turn nudges.
3. Read enough of the full prompt composition to understand how the new rule
   interacts with existing rules. Do not rely only on `rg` hits around the
   changed phrase.
4. Search for older language that may now conflict with the change, especially
   synonyms, negative examples, docs copied into prompts, tool descriptions,
   and repair prompts.
5. Resolve contradictions by changing the source-of-truth rule, not by adding
   another competing sentence elsewhere.
6. Keep model-facing wording precise: say when to do something, when not to do
   it, and what to do instead.
7. Update project docs or skills when the prompt change alters product behavior,
   protocol semantics, tool boundaries, or future agent workflow.
8. Verify with at least typecheck or the relevant build when code/runtime files
   changed. Restart the local server when the changed prompt affects runtime.

## Coherence Checklist

- The prompt no longer contains both an old rule and a new rule for the same
  behavior.
- Terms are unambiguous. For example, distinguish visible tutor plans from
  persistent practice guides, learner messages from teacher-only context, and
  exercises from optional navigation choices.
- The model is told what to do instead of the forbidden behavior.
- Tool descriptions match the system prompt and include the same boundaries.
- Repair/correction prompts know the current protocol and do not repair toward
  removed or deprecated block types.
- Prompt fragments injected only on the first turn do not contain instructions
  that should persist forever, and persistent context does not contain one-turn
  commands.
- Learner-visible language rules remain consistent across blocks, tools, and
  context prompts.
- The change does not make the model overuse a generic fallback such as
  `message` when a typed block is required.

## Red Flags

- Adding "never do X" without saying the preferred replacement.
- Adding a new exception in `system.md` while an older block JSDoc still forbids
  it.
- Changing a block protocol without updating repair prompts, schemas, renderers,
  docs, or skills that mention that block.
- Changing a tool boundary only in the system prompt while the tool description
  still invites the old behavior.
- Reusing words with overloaded meanings, such as `plan`, `module`, `session`,
  `conversation`, `quiz`, `exercise`, or `progress`, without clarifying scope.
- Trusting the model to infer that a historical decision was superseded when
  docs or prompts still describe it as current.

## Review Output

When the user asks for analysis only, report contradictions, ambiguity, and
likely model failure modes first. When the user asks to implement, fix the
prompt and related docs/code directly, then summarize:

- which loop was affected
- which prompt sources were reviewed
- what contradiction or regression risk was removed
- what verification was run
