---
name: tutor-platform-help
description: Use when adding, removing, renaming, relocating, or changing the purpose of any main site feature, navigation area, activity type, sharing/results behavior, or top-level route in Mister F, so the tutor's in-chat platform knowledge (the get_platform_help tool and system-prompts/tutor/platform-overview.md) does not drift from the actual product. Also use when reviewing that help for accuracy.
---

# Tutor Platform Help

Mr. F answers learner/teacher questions about the app ("how do I create a quiz?",
"where are my shared resources?", "where do I see my progress?") through the
`get_platform_help` tool. The tool has **no product knowledge of its own** — it
returns one canonical file. That file is written by hand, so it silently goes
stale whenever the product changes and nobody updates it. This skill exists to
close that gap.

## Single source of truth

- Knowledge file: `misterf-web/system-prompts/tutor/platform-overview.md`
- Tool: `misterf-web/src/server/services/llmTutor/platformTools.ts`
  (`get_platform_help`, no params, always available, returns the file verbatim).
- Prompt pointer / boundary: the **Tool Use Boundaries** section of
  `misterf-web/system-prompts/tutor/system.md`.
- Docs: `docs/architecture/architecture.md` (Tool Architecture → Platform help
  tool) and `docs/tutor/runtime.md` (Tools Available to Mr. F).

Edit the overview file directly; there is no generator. The file is model-facing
reference text, not learner-visible copy.

## When you must update the overview

Update `platform-overview.md` in the **same change** whenever you:

- add, remove, or rename a **main navigation area** or top-level route
  (`/`, `/resources`, `/media-library`, `/progress`, `/profiles`, `/settings`,
  `/credits`, the translator, …);
- add, remove, or rename an **activity/resource type** (quiz, roleplay, practice
  guide, scene-media item) or change how one is **created** (the entry points and
  create-from-conversation flow);
- change **sharing, results collection, consent, or the Trash/restore** behavior
  in a way a learner would ask about;
- change **profiles, progress, or credits** in a user-visible way;
- move a feature so an existing "where is X" answer would now be wrong.

Pure internal refactors that do not change what a user sees or where they go do
not require an edit — but confirm the answers still hold.

## How to write it

- **Feature-level and navigational only.** Say what each feature is and where to
  find or start it. Do not document every field, option, or edge case — it is not
  a manual, and depth is what rots fastest.
- **Keep route paths and section names accurate.** They are the load-bearing part
  of a "where is X" answer. Verify each path against the real nav
  (`views/partials/app-shell-open.ejs`) and route files.
- Write it in English (the model translates to the learner's instruction
  language at answer time). Refer to on-screen areas by their feature name, not by
  a hard-coded localized label.
- Preserve the "How to use it" header rules: answer briefly, in the instruction
  language, and that the tutor performs **no** app actions (it has no tools to
  create, edit, share, or open resources) — only points the learner to where they
  can act. If you add a feature the tutor also cannot act on, that boundary
  already covers it; do not imply the tutor can do it.
- Match the vocabulary the app and the other tutor prompts use for the same thing
  (see `system-prompt-coherence`); do not invent a new name for an existing
  feature.

## After editing

- The prompt is cached in-process (`loadSystemPrompt`), so **restart the local
  server** for the change to take effect (`restart-local-server`).
- Run the placeholder guard and tool tests:
  `tests/server/promptPlaceholders.test.ts` (every `system-prompts/**/*.md` must
  be registered there — it already is for this file) and
  `tests/llmTutor/platformTools.test.ts`. If you add a new stable navigational
  anchor the test asserts on, keep them in sync.
- The **content itself is not behavior-tested** — no test checks that the
  described features match the product. Accuracy is manual; that is the whole
  reason this skill exists. When in doubt, open the app and confirm.
- If the tool's name, parameters, or availability change (not just its text),
  also update `system.md` boundaries and the two docs above, per
  `llm-tool-documentation`.

Related skills: `system-prompt-coherence`, `llm-tool-documentation`,
`restart-local-server`.
