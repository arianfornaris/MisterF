# V1 Cleanup Implementation Tracker

Date: 2026-06-15

This tracker turns the V1 cleanup audit into small implementation steps. Keep each step scoped, verify it independently, and update the status as work lands.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

## Phase 0: Stabilization Guardrails

### 0.1 Add Fresh Migration Coverage

- [x] Add a test or script that creates a temporary SQLite database and runs `migrate()` from scratch.
- [x] Assert all migrations are recorded in order.
- [x] Assert key tables exist after migration.
- [x] Add the check to the normal test command or document a dedicated command.
- [x] Add a production-to-development sync workflow for migration rehearsal against production-shaped data.

Verification:

- `npm test`
- `npm run test:typecheck`
- Fresh migration test passes on an empty database.

Notes:

- Implemented in `tests/db/migrations.test.ts`.
- The v1 baseline now uses a single `create_current_schema` migration for fresh installs.
- After the v1 baseline ships, new schema changes must be forward-only migrations with new ids.
- Production-shaped migration rehearsal is documented in `docs/operations/sync-production-to-development.md` and implemented by `npm run sync-prod-to-dev`.

### 0.2 Add Main Route Smoke Coverage

- [ ] Add minimal render smoke tests for `/`, `/login`, `/signup`, `/practice-modules`, `/chatrooms`, `/progress`, `/credits`, `/settings`.
- [ ] Seed or mock the minimum auth/profile state needed for authenticated routes.
- [ ] Cover unauthenticated redirects for protected pages.

Verification:

- `npm test`
- Smoke tests fail on missing templates or broken render data.

### 0.3 Document Runtime Environment

- [ ] Update `.env.example` if any active setting is missing.
- [ ] Update README with dev, build, start, migration, and production notes.
- [ ] Document required versus optional integrations: OpenRouter, Stripe, SMTP, Google OAuth.

Verification:

- README matches `src/server/config/env.ts`.
- `.env.example` contains no secrets.

## Phase 1: Blocking Cleanup

### 1.1 Repair Migration History

- [x] Decide whether migrations are historical increments or a current-schema bootstrap.
- [x] Remove duplicated table/index creation from the chosen path.
- [x] Preserve compatibility for existing local/production databases.
- [x] Add a note explaining the migration strategy.

Verification:

- Fresh migration test passes.
- Existing development database migrates without destructive changes.
- `npm run typecheck`
- `npm test`

Notes:

- Completed together with step 0.1 by consolidating the v1 fresh-install schema into migration `id: 1`.
- Existing databases that already recorded migration `id: 1` are not re-created by this change.
- The next production schema change should be migration `id: 2`.

### 1.2 Remove Tracked Empty Databases

- [ ] Remove `misterf-web/data.sqlite` from version control.
- [ ] Remove `misterf-web/data/app.db` from version control.
- [ ] Confirm neither file is referenced by code, docs, or deployment scripts.

Verification:

- `git ls-files` no longer lists those files.
- App still uses `DATABASE_PATH` or the default `./data/misterf.sqlite`.

### 1.3 Tighten Ignore Rules

- [ ] Ignore generated SQLite and DB files consistently.
- [ ] Ignore SQLite WAL/SHM sidecars for every allowed database extension.
- [ ] Keep `.env.example` tracked.
- [ ] Confirm local `.DS_Store`, `.env.*`, and database files stay ignored.

Verification:

- `git status --ignored --short`
- No real source files are accidentally ignored.

### 1.4 Remove Temporary Tracked Artifacts

- [ ] Decide whether `.tmp-chatrooms-auth.html` is an intentional fixture.
- [ ] Remove it if it is temporary.
- [ ] If it is intentional, rename it into a documented fixture location.

Verification:

- No root-level temporary HTML artifacts remain.

### 1.5 Clean Build Artifact Policy

- [ ] Decide whether `public/build` should be committed.
- [ ] If committed, update `scripts/build-client.mjs` to clean stale JS entries before build.
- [ ] If not committed, update `.gitignore` and deployment docs.
- [ ] Remove stale hashed assets according to the chosen policy.

Verification:

- `npm run build:client`
- Only current build artifacts remain, or generated artifacts are untracked by design.

## Phase 2: Route And Handler Architecture

### 2.1 Move Practice Module Actions Out Of Auth

- [ ] Move create/update/archive/restore/delete/favorite/share collection actions from `auth/forms.ts` to `practiceModules/handlers.ts`.
- [ ] Keep route behavior and redirects unchanged.
- [ ] Remove unused imports from `auth/forms.ts`.

Verification:

- `npm run typecheck`
- `npm test`
- Manual smoke: create, edit, archive, restore, share, and delete a practice module.

### 2.2 Move Profile Actions Out Of Auth

- [ ] Move create/update/switch profile handlers to `profiles/handlers.ts`.
- [ ] Keep onboarding behavior intact.
- [ ] Remove profile-related repository imports from `auth/forms.ts` where possible.

Verification:

- `npm run typecheck`
- Manual smoke: create profile, switch profile, edit profile, onboarding save/skip.

### 2.3 Reduce `auth/forms.ts` To Auth Concerns

- [ ] Keep login, signup, forgot/reset password, change password, email verification, logout, and session helpers.
- [ ] Delete legacy page-model code that no route uses.
- [ ] Confirm `auth/forms.ts` no longer imports chatroom or practice module repositories.

Verification:

- `rg "PracticeModule|ChatRoom|practice-modules|chatrooms" src/server/auth/forms.ts` returns no unrelated resource logic.
- `npm run typecheck`

### 2.4 Split Domain Routers

- [ ] Create route modules for auth, profiles, practice modules, chatrooms, payments, legal, progress, and superadmin.
- [ ] Mount routers from `server.ts`.
- [ ] Keep middleware ordering unchanged, especially Stripe raw body, URL encoding, CSRF, session loading, and onboarding redirects.

Verification:

- `npm run typecheck`
- `npm test`
- Manual smoke of representative routes.

## Phase 3: UI And Styling Cleanup

### 3.1 Replace Misleading Shared Class Names

- [ ] Introduce a neutral shared layout class for resource pages.
- [ ] Replace non-practice-module uses of `practice-modules-view`.
- [ ] Keep domain-specific classes only where the page has domain-specific styling.

Verification:

- `rg "practice-modules-view" views` only returns actual practice module usage or intentional compatibility wrappers.
- Visual smoke on credits, progress, profiles, settings, chatrooms, and practice modules.

### 3.2 Organize CSS By Responsibility

- [ ] Identify reusable app shell styles.
- [ ] Identify resource list/detail styles.
- [ ] Identify tutor block and exercise card styles.
- [ ] Move styles in small batches without visual redesign.

Verification:

- `npm run build:client`
- Visual smoke on desktop and mobile widths.

### 3.3 Align Custom Styling With Flatly

- [ ] Review custom gradients, shadows, and color tokens.
- [ ] Remove or reduce styles that duplicate Bootstrap/Bootswatch behavior.
- [ ] Keep app-specific tutor/exercise styling where Bootstrap has no equivalent.

Verification:

- Main pages still read as Bootswatch Flatly.
- Buttons, alerts, cards, nav, modals, and forms use Bootstrap semantics.

## Phase 4: LLM, Credit, And Payment Guardrails

### 4.1 Add Credit Gate Coverage

- [ ] Inventory every server-side `generateText` call.
- [ ] Document whether each call is behind a handler/socket/tool credit check.
- [ ] Add a test or static check that flags new ungated LLM entry points.

Verification:

- `rg "generateText" src/server`
- Credit gate test/check passes.

### 4.2 Improve Credit Exhaustion UI Coverage

- [ ] Test web handler behavior when credit is exhausted.
- [ ] Test socket event behavior when credit is exhausted.
- [ ] Confirm user-facing errors do not expose stack traces.

Verification:

- Unit or integration tests for `isCreditExhaustedError` paths.
- Manual smoke with mocked exhausted credit.

### 4.3 Add Stripe Webhook Idempotency Tests

- [ ] Cover `checkout.session.completed`.
- [ ] Cover duplicate event/session handling.
- [ ] Cover failed fulfillment status.
- [ ] Confirm credited balance is not duplicated.

Verification:

- `npm test`
- Payment repository state matches expected ledger entries.

### 4.4 Introduce Runtime Logging Policy

- [ ] Add or document logger levels.
- [ ] Gate debug logs by environment.
- [ ] Redact learner text, LLM output, secrets, and provider keys from production logs.
- [ ] Remove browser debug logs unless explicitly needed.

Verification:

- `rg "console\\." src`
- Production mode does not print debug-only content.

## Phase 5: Documentation And Release Readiness

### 5.1 Update README For V1

- [ ] Describe current product scope accurately.
- [ ] Document setup, development, build, production start, and PM2.
- [ ] Document database path and migration behavior.
- [ ] Link architecture docs and issue trackers.

Verification:

- README matches current scripts and `env.ts`.

### 5.2 Curate Or Retire `TODO.txt`

- [ ] Move still-relevant ideas into `docs/issues` or a backlog document.
- [ ] Remove completed or stale items.
- [ ] Delete `TODO.txt` if it is no longer the source of truth.

Verification:

- No duplicated/conflicting roadmap source remains.

### 5.3 Final V1 Checklist

- [ ] Fresh clone/install instructions work.
- [ ] Fresh database migration works.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Client build passes.
- [ ] Main app flows smoke-tested.
- [ ] Stripe webhook configured or explicitly disabled in dev.
- [ ] OpenRouter/credit behavior documented.
- [ ] README and docs reflect current product behavior.

Verification:

- Record final commands and manual smoke notes in this tracker before tagging v1.
