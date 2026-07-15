---
name: roleplay-pedagogy-and-evaluation
description: Use when adding, editing, or reviewing Mister F roleplay behavior, including roleplay authoring prompts, the roleplay runtime, roleplay evaluation prompts or schemas, evaluation review UI, or roleplay guest/free access policy.
---

# Roleplay Pedagogy And Evaluation

Use this skill with `resource-attempt-runtime` for the attempt lifecycle,
`ai-authoring-chat-conventions` for authoring, and `system-prompt-coherence`
when editing `system-prompts/resources/roleplay-*.md`.

## Core Rules

- A roleplay is free-form two-character practice: title, one complete
  learner-facing `description`, required `A1-A2`, `B1-B2`, or `C1` level, and
  fixed `learner` and `ai` characters with name/description only. No separate
  scenario, pedagogical focus, runtime instructions, turn limit, guided
  branching, per-character personas, speaking styles, or opening lines are
  stored on the resource.
- The roleplay description is the single narrative source. It contains the
  setup, learner goal, relevant practice goal, and conversation constraints.
  Character descriptions contain only character-specific context and behavior.
- Runtime correction policy and evaluation policy belong to system prompts,
  never to resource-authored fields.
- Roleplay authoring has no `Chat IA` tab. One page-level `Modify with AI`
  action opens a modal where the author describes the desired modification.
  It uses the complete current form as context and may change any authoring
  field. Hold the proposal outside the database, show a before/after comparison
  containing only changed fields, and persist the server-held draft atomically
  only after explicit approval. Closing or canceling discards the proposal;
  never append roleplay authoring history for this flow.
- AI modification applies the smallest coherent edit to the field, character,
  or character property named by the author. Propagate direct references and
  dependencies across fields—for example, update every direct mention of a
  renamed character—while preserving the surrounding wording and every
  unrelated value exactly. A related field may change only when it directly
  references the changed value, the author asks for it, or the requested edit
  would otherwise create a direct contradiction or invalid draft; keep each
  dependent change minimal and disclose it in the proposal summary.
- The AI character's first line is generated dynamically when an attempt
  starts; never store it on the resource.
- Evaluation judges only the learner's English production: grammar,
  vocabulary, word order, spelling, punctuation, clarity, register, idiomatic
  phrasing, and task-appropriate communication.
- Never grade morality, personality, politeness, ethics, social behavior, or
  fictional choices. Rude, dramatic, or uncomfortable scenarios are legitimate
  creative practice. Mention tone/register only as an English-usage point.
- Evaluation reviews each learner turn in order with a
  sentence-evaluation-style inline review (`correct` / `improve` / `error`
  parts that reconstruct the original text) plus per-turn feedback, and
  produces summary, strengths, difficulties, recommendations, and vocabulary
  in Spanish.
- Use the roleplay description to judge task-appropriate communication, while
  keeping feedback focused exclusively on the learner's English production.
- Roleplay descriptions should be creative and varied; encourage authors (and
  the draft prompt) toward concrete situations rather than generic conversation.
- The learner decides when to finish the exchange; there is no configured or
  automatic learner-turn limit.
- Access policy: viewing a shared roleplay is anonymous; starting an attempt
  requires an account and runs on the learner's own credit-gated key. Public
  or free anonymous attempts are a deferred post-V1 decision; do not add them
  casually.

## Checks Before Finishing

- Verify evaluation prompt changes keep the exact JSON shape expected by the
  roleplay evaluation schema and its correction retry.
- Verify learner turns are preserved verbatim in evaluation entries.
- Verify evaluated authenticated attempts still record learner progress
  events.
- Run typecheck/tests and restart the local server when server or prompt code
  changed.
