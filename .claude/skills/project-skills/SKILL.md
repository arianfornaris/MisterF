---
name: project-skills
description: Points to this project's engineering convention skills, which live in `.agents/skills/` (NOT `.claude/skills/`). Consult before any code, UI, EJS, database/migration, LLM/prompt/tool, testing, deployment, worktree, or resource/roleplay/authoring task in this repo, then read the matching skill there.
---

# Mister F Project Skills

This project's convention skills are multi-agent and live in **`.agents/skills/`**,
one folder per skill with a `SKILL.md` — not under `.claude/skills/`, so they are
not auto-surfaced by name.

Before working in this repo, browse `.agents/skills/` and read the `SKILL.md`
whose `description` matches your task (several can apply at once). Do not rely on
a hardcoded list here — the folder is the source of truth.

```bash
ls .agents/skills/
# read the relevant one:
cat .agents/skills/<name>/SKILL.md
```
