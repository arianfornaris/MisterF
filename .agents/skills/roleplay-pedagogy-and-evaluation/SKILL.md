---
name: roleplay-pedagogy-and-evaluation
description: Use when adding, editing, or reviewing Mister F roleplay behavior, including roleplay authoring prompts, the roleplay runtime, turn limits, roleplay evaluation prompts or schemas, evaluation review UI, or roleplay guest/free access policy.
---

# Roleplay Pedagogy And Evaluation

Use this skill with `resource-attempt-runtime` for the attempt lifecycle,
`ai-authoring-chat-conventions` for authoring, and `system-prompt-coherence`
when editing `system-prompts/resources/roleplay-*.md`.

## Core Rules

- A roleplay is free-form two-character practice: fixed `learner` and `ai`
  characters with name/description only, plus scenario, level, and one
  pedagogical focus field. No guided branching, no per-character personas,
  speaking styles, or opening lines stored on the resource.
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
- Focus feedback on the roleplay's `pedagogicalFocus`, but flag important
  general English issues too.
- Scenarios should be creative and varied; encourage authors (and the draft
  prompt) toward concrete situations rather than generic conversation.
- Optional max learner turns caps the exchange; the runtime ends the roleplay
  and moves to evaluation when the limit is reached.
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
