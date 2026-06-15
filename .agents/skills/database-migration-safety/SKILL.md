---
name: database-migration-safety
description: Use before any Mister F change that touches persisted data, database tables, migrations, repository functions, auth/session storage, payments, learner progress, practice modules, chatrooms, tutor reports, or any code path that reads or writes SQLite. Requires reviewing the migration history before editing and preserving production-safe migration behavior.
---

# Database Migration Safety

Use this skill before changing persisted data behavior in Mister F.

## Core Rule

Always inspect the migration state before making database-related changes. The project can have production data, so migrations must be forward-only after the v1 baseline.

## Workflow

1. Read `misterf-web/src/server/db/migrations.ts`.
2. Read the affected repository functions in `misterf-web/src/server/db/repository.ts`.
3. Check docs that describe the data model, especially `docs/architecture/data-model.md` when relevant.
4. Decide whether the change needs:
   - no schema change,
   - a new forward migration,
   - a data backfill,
   - a compatibility path for existing rows.
5. For production-era changes, do not edit old applied migrations unless the user explicitly chooses a baseline reset and existing production compatibility is accounted for.
6. Add or update migration tests for fresh databases and, when relevant, existing-schema upgrade paths.
7. Run at least:
   - `npm run typecheck`
   - `npm test`
   - a fresh SQLite migration check

## V1 Baseline Policy

The v1 baseline can use a single correct `create_current_schema` migration for fresh installs. After that baseline ships, every schema change must be a new migration with a new id.

## Red Flags

- Creating a table in more than one migration.
- Adding a column to a table that is already created with that column in the baseline migration.
- Reordering migrations without considering existing `schema_migrations` rows.
- Dropping or renaming a column without a compatibility or data migration plan.
- Changing repository row mapping without checking that the schema provides the mapped columns.
