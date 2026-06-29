---
name: learner-progress-events
description: Use when adding, editing, or reviewing Mister F learner progress behavior for evaluated resources, tutor conversation reports, assignment attempts, roleplay attempts, bitácora/progress UI, progress event source labels, or `record*Progress` flows.
---

# Learner Progress Events

Use this skill with `database-migration-safety` before changing persistence or
schema code.

## Core Rules

- Learner progress is profile-scoped and stored in `learner_progress_events`.
  The global progress profile is rebuilt from recent events.
- Record progress for authenticated, evaluated attempts or reports with a user
  id, profile id, and result.
- Do not introduce a separate persisted preview/test attempt mode. Visual
  previews are fine only when they do not create attempt rows.
- Each evaluable resource source should have a stable `sourceType`, `sourceId`,
  title, summary, and compact details JSON.
- Resource-backed events should set `details.resourceId` and
  `details.resourceType` so progress, vocabulary, home suggestions, and future
  resource follow-ups can identify the origin.
- After creating or updating an event, refresh the learner progress summary for
  the profile.
- When the source table stores a `progress_event_id`, update it after the event
  is written.
- `/progress?tab=events` should label sources through a shared server helper,
  not view-specific conditionals.
- The bitácora/progress UI should include evaluated tutor conversations,
  assignments, roleplays, and future evaluated resources once they produce
  events.

## Current Labels

- `assignment_attempt` or `resourceType: "assignment"` -> `Tarea`
- `roleplay_attempt` or `resourceType: "roleplay"` -> `Roleplay`
- `practice_guide` resource metadata -> `Guía de Práctica`
- `tutor_conversation_report` -> `Bitácora`
- unknown legacy events -> `Práctica`

## Checks Before Finishing

- Review `misterf-web/src/server/db/migrations.ts` before adding a new source
  type or persisted field.
- Update `docs/architecture/data-model.md` and relevant feature-flow docs when
  adding or changing a progress source.
- Add or update repository/service tests for new source behavior when the change
  is not purely presentational.
- Run typecheck/tests and restart the local server when server or view code
  changed.
