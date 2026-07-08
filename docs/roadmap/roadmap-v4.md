# Roadmap V4

Date: 2026-07-07 (last updated: 2026-07-07)

Status: **Idea backlog.** V4 has no committed scope yet; items land here when
they are explicitly deferred past [Roadmap V3](roadmap-v3.md). Remaining
product-feature candidates stay in the idea inbox,
[issues/incomming.md](../issues/incomming.md), until they are promoted here.

This document is the living tracker for V4: items move through the status
legend as work happens (`[~]` when started, `[x]` with a date when done), and
notes are added inline when decisions change an item's scope. There is no fixed
execution order — the next item is chosen by analyzing the current state at
each step.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Generalized Translation Scaffolding (Any Support Language)

Deferred here from a V2 audit discussion on 2026-07-07.

- [ ] Generalize the two Spanish-hardcoded translation mechanics —
  `translate_to_english` / `understand_in_spanish` (tutor blocks and quiz
  item kinds) — into support-language translation scaffolding available to
  every non-English instruction language. Conceptually they are "translate
  from your language to English" and "explain in your language what this
  English sentence means"; today `ht` profiles use the monolingual block
  set only because the blocks were Spanish-hardcoded, not as a pedagogical
  decision. The V2 registry work already centralized the gating
  (`includesSpanishTranslationBlocks` drives the tutor protocol, the tutor
  quiz set, quiz authoring prompts, and the authoring UI kind picker), so
  the remaining work is:
  - Rename the flag to something like `includesTranslationBlocks` and
    enable it for `ht` (and future support languages).
  - Parametrize the block docs (`translate-to-english-prompt.md`,
    `understand-in-spanish-prompt.md`, `quiz-translation-items.md`,
    `quiz-translation-authoring-kinds.md`) by `INSTRUCTION_LANGUAGE_NAME`
    instead of saying "Spanish" in their bodies.
  - Fill the per-language registry fragments that are empty today for
    `ht` (quiz evaluation/authoring translation rules).
  - Review exercise-submission evaluation and the leakage patterns for
    the `ht` case; review UI labels ("Entender en español" → generic).
  - Keep the existing persisted discriminators (`understand_in_spanish`
    etc.) as-is: they are internal identifiers stored in quiz drafts,
    snapshots, and message blocks, and renaming them would force a data
    migration for cosmetic benefit.
  - QA pass with an `ht` profile (tutor blocks, quiz authoring, attempt
    evaluation, shared es-authored quizzes still rendering as authored).
