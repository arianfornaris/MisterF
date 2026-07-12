---
name: project-skills-index
description: Index of the Mister F project's engineering convention skills, which live in `.agents/skills/` (NOT `.claude/skills/`). Consult at the start of any code, UI, EJS, database/migration, LLM/prompt/tool, testing, deployment, worktree, or resource/roleplay/authoring task in this repo to find and read the matching convention skill before making changes.
---

# Mister F Project Skills Index

This project keeps its engineering convention skills in **`.agents/skills/`**, one
folder per skill with a `SKILL.md`. They are not under `.claude/skills/`, so they
are not auto-surfaced by name — use this index to find the relevant one, then read
its `SKILL.md` in full before working in that area.

Path: `.agents/skills/<name>/SKILL.md`.

## When to use

Before editing code, prompts, views, or data in this repo, scan the list below.
If your task matches a skill's area, open and follow that skill first. Several can
apply at once (e.g. an EJS modal that hits the database and calls an LLM).

## The skills

- **project-language-conventions** — any repo artifact (code, docs, prompts,
  commits, UI copy): English by default, product copy via i18n catalogs.
- **parallel-agent-worktrees** — working in an isolated git worktree, parallel
  branches, worktree server/logs, handoff and integration.
- **restart-local-server** — restarting the local pm2 server after server-
  affecting changes, and reading its logs.
- **production-server-ops** — production SSH, deploy, secrets, pm2, prod logs.
- **versioning-and-releases** — version bumps, tagging, release/deploy scheme.
- **testing-conventions** — when to test, Vitest layout, the verification
  commands, route/render and repository/migration tests, architecture guards.
- **database-migration-safety** — any change touching SQLite, migrations,
  repositories, or persisted data.
- **llm-credit-gate** — any server flow that invokes an LLM/OpenRouter; enforce
  credit checks and product-safe errors.
- **llm-tool-documentation** — defining or editing any LLM-accessible tool and
  its input schema.
- **system-prompt-coherence** — creating/editing/reviewing any LLM system prompt
  or prompt loop as a coherent whole.
- **tutor-protocol-jsdoc** — tutor structured response blocks, llmTutor
  schemas/types, block renderers and prompts.
- **ai-authoring-chat-conventions** — AI draft generation, AI chat revision tabs,
  authoring history, pending-generation modals.
- **markdown-content-fields** — fields that store or render markdown.
- **ejs-view-structure** — creating/refactoring EJS pages (one view per page;
  partials as shared utilities).
- **bootstrap-ui-conventions** — building UI: prefer Bootstrap/Bootswatch/Icons
  before custom CSS.
- **bootstrap-icons-conventions** — icons in UI (Bootstrap Icons only).
- **bootstrap-modal-conventions** — Bootstrap modals and close/cancel actions.
- **bootstrap-tabs-conventions** — tabbed UI sections.
- **theme-surface-conventions** — page containers, cards, backgrounds, borders,
  theme portability with Flatly.
- **resource-page-conventions** — resource catalog/detail/edit/attempt/result
  pages and shared resource navigation.
- **resource-attempt-runtime** — quiz/roleplay attempt flows, snapshots,
  statuses, evaluation runs, result pages.
- **resource-sharing-conventions** — share links, share modals, access grants,
  anonymous shared-resource flows.
- **resource-follow-up-conversations** — follow-up tutor conversations from
  results ("Practicar", "Crear recurso").
- **learner-progress-events** — learner progress for evaluated resources,
  reports, and `record*Progress` flows.
- **roleplay-pedagogy-and-evaluation** — roleplay authoring/runtime, turn limits,
  evaluation prompts/schemas, access policy.
- **roleplay-character-avatar** — roleplay character avatar assets and their
  registry metadata.

If a task changes a shared convention, update the matching skill in the same
branch (see `parallel-agent-worktrees`), and update this index when a skill is
added, removed, or renamed.
