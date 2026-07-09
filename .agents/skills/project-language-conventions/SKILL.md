---
name: project-language-conventions
description: Use for any Mister F task that creates or edits repository artifacts, including code, comments, documentation, issue reports, trackers, prompts, tests, commit messages, or user-facing files. The user may speak Spanish, but repository artifacts are written in English by default, and product UI copy must use the app's i18n catalogs.
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

## Product UI Copy

Mister F's product UI is internationalized. Do not add hard-coded learner-facing
UI strings directly to EJS templates, client scripts, route handlers, modals,
buttons, alerts, empty states, or validation/status surfaces.

When adding or editing product chrome:

- Read `docs/architecture/i18n.md` if the local i18n pattern is not already loaded.
- Add or reuse keys in the server i18n catalogs under `misterf-web/src/server/i18n/locales/`.
- Provide values for every supported instruction language in the registry
  (`misterf-web/src/server/i18n/languages.ts`), currently Spanish (`es`),
  English (`en`), and Haitian Creole (`ht`).
- Render server views with `t('namespace.key')`.
- For browser code, use the injected client catalog (`window.__APP_I18N__`) and
  `src/client/shared/i18n.js`, or pass translated strings through safe
  server-rendered `data-*` attributes.
- Treat missing-key fallback as a debugging aid, not as an acceptable shipped state.

## Intentional Non-English Content

Non-English text is allowed when the artifact is intentionally user-authored,
learner-facing learning content, locale catalog content, or model-facing content
for a specific instruction-language experience, such as:

- values inside locale catalogs (`locales/es.ts`, `locales/ht.ts`, etc.)
- tutor prompts or prompt fragments that must instruct the tutor to speak Spanish
- tutor prompts or prompt fragments for another supported instruction language
- fixtures that intentionally test Spanish output
- fixtures that intentionally test another supported language
- existing authored/stored content being preserved or minimally edited

## Workflow

1. Before writing files, decide whether the content is project artifact text,
   product UI copy, locale catalog content, prompt content, or user-authored
   learning content.
2. Use English for project artifacts by default.
3. For product UI copy, use i18n keys and update every supported locale.
4. If non-English text appears outside locale catalogs, prompts, fixtures, or
   intentionally authored learning content, verify it is deliberate.
5. If a previous artifact was created in the wrong language or bypasses i18n,
   translate, catalog, or replace it when touching that area.
