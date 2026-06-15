---
name: project-language-conventions
description: Use for any Mister F task that creates or edits repository artifacts, including code, comments, documentation, issue reports, trackers, prompts, tests, commit messages, or user-facing files. The user may speak Spanish, but project artifacts must be written in English unless the artifact is intentionally Spanish learner-facing product copy.
---

# Project Language Conventions

Use this skill whenever creating or editing files in the Mister F repository.

## Core Rule

The user may chat in Spanish. Reply conversationally in Spanish when that is the user's language.

Write repository artifacts in English:

- source code identifiers when naming new symbols
- code comments
- documentation under `docs/**`
- issue reports and implementation trackers
- tests and test names
- commit messages, PR text, and changelog-style notes
- agent-facing skills and project instructions

## Allowed Spanish

Spanish is allowed when the artifact is intentionally learner-facing product copy or model-facing content for the Spanish-speaking learner experience, such as:

- EJS/UI labels shown to the learner
- tutor prompts or prompt fragments that must instruct the tutor to speak Spanish
- fixtures that intentionally test Spanish output
- existing Spanish copy being preserved or minimally edited

## Workflow

1. Before writing files, decide whether the file is a project artifact or learner-facing product copy.
2. Use English for project artifacts by default.
3. If Spanish appears in a project artifact, verify it is deliberate learner-facing content.
4. If a previous artifact was created in Spanish by mistake, translate or replace it with English when touching that area.
