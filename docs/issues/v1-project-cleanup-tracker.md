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

- [x] Add minimal render smoke tests for `/`, `/login`, `/signup`, `/practice-modules`, `/chatrooms`, `/progress`, `/credits`, `/settings`.
- [x] Seed or mock the minimum auth/profile state needed for authenticated routes.
- [x] Cover unauthenticated redirects for protected pages.

Verification:

- `npm test`
- Smoke tests fail on missing templates or broken render data.

Notes:

- Implemented in `tests/server/routes.test.ts`.
- The server now exports `app`, `server`, `io`, and `startServer()` so tests can import it without opening the configured app port.
- Anonymous smoke coverage verifies public route rendering and protected route redirects.

### 0.3 Document Runtime Environment

- [x] Update `.env.example` if any active setting is missing.
- [x] Update README with dev, build, start, migration, and production notes.
- [x] Document required versus optional integrations: OpenRouter, Stripe, SMTP, Google OAuth.

Verification:

- README matches `src/server/config/env.ts`.
- `.env.example` contains no secrets.

Notes:

- `.env.example` now includes `DATABASE_PATH` and removes the stale `OPENROUTER_USER_KEY_INCLUDE_BYOK_IN_LIMIT` entry.
- `README.md` now documents setup, scripts, environment files, migrations, production PM2 usage, and production-to-development database sync.

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

- [x] Remove `misterf-web/data.sqlite` from version control.
- [x] Remove `misterf-web/data/app.db` from version control.
- [x] Confirm neither file is referenced by code, docs, or deployment scripts.

Verification:

- `git ls-files` no longer lists those files.
- App still uses `DATABASE_PATH` or the default `./data/misterf.sqlite`.

Notes:

- Both files were empty and not used by the app.
- The runtime database remains `DATABASE_PATH` or `./data/misterf.sqlite`.

### 1.3 Tighten Ignore Rules

- [x] Ignore generated SQLite and DB files consistently.
- [x] Ignore SQLite WAL/SHM sidecars for every allowed database extension.
- [x] Keep `.env.example` tracked.
- [x] Confirm local `.DS_Store`, `.env.*`, and database files stay ignored.

Verification:

- `git status --ignored --short`
- No real source files are accidentally ignored.

Notes:

- `misterf-web/.gitignore` now covers root-level `data.sqlite`, SQLite sidecars, and generated `data/*.db` files.
- The repository root `.gitignore` now ignores `.DS_Store` and `.tmp-*` artifacts.

### 1.4 Remove Temporary Tracked Artifacts

- [x] Decide whether `.tmp-chatrooms-auth.html` is an intentional fixture.
- [x] Remove it if it is temporary.
- [x] If it is intentional, rename it into a documented fixture location.

Verification:

- No root-level temporary HTML artifacts remain.

Notes:

- `.tmp-chatrooms-auth.html` was not referenced by source, docs, scripts, or tests except as cleanup debt, so it was removed instead of renamed.

### 1.5 Clean Build Artifact Policy

- [x] Decide whether `public/build` should be committed.
- [x] If committed, update `scripts/build-client.mjs` to clean stale JS entries before build.
- [x] If not committed, update `.gitignore` and deployment docs.
- [x] Remove stale hashed assets according to the chosen policy.

Verification:

- `npm run build:client`
- Only current build artifacts remain, or generated artifacts are untracked by design.

Notes:

- `public/build` is intentionally committed so the lightweight production server does not need to build client assets during deploy.
- `scripts/build-client.mjs` now removes stale Vite output before each local client build while preserving non-generated brand assets.
- The current committed build output is limited to the active manifest, brand images, CSS, shared chunk, and current entry bundles.

## Phase 2: Route And Handler Architecture

### 2.1 Move Practice Module Actions Out Of Auth

- [x] Move create/update/archive/restore/delete/favorite/share collection actions from `auth/forms.ts` to `practiceModules/handlers.ts`.
- [x] Keep route behavior and redirects unchanged.
- [x] Remove unused imports from `auth/forms.ts`.

Verification:

- `npm run typecheck`
- `npm test`
- Manual smoke: create, edit, archive, restore, share, and delete a practice module.

Notes:

- Practice module mutations now live in `src/server/practiceModules/handlers.ts`.
- Legacy `Lesson` handler names were replaced at the route layer with `PracticeModule` names.
- Route redirects were copied from the existing handlers.

### 2.2 Move Profile Actions Out Of Auth

- [x] Move create/update/switch profile handlers to `profiles/handlers.ts`.
- [x] Keep onboarding behavior intact.
- [x] Remove profile-related repository imports from `auth/forms.ts` where possible.

Verification:

- `npm run typecheck`
- Manual smoke: create profile, switch profile, edit profile, onboarding save/skip.

Notes:

- Profile create/update/switch handlers now live in `src/server/profiles/handlers.ts`.
- Profile onboarding remains mounted before `redirectIncompleteProfileOnboarding`.
- Profile switch/create `returnTo` behavior remains compatible with the previous handlers.

### 2.3 Reduce `auth/forms.ts` To Auth Concerns

- [x] Keep login, signup, forgot/reset password, change password, email verification, logout, and session helpers.
- [x] Delete legacy page-model code that no route uses.
- [x] Confirm `auth/forms.ts` no longer imports chatroom or practice module repositories.

Verification:

- `rg "PracticeModule|ChatRoom|practice-modules|chatrooms" src/server/auth/forms.ts` returns no unrelated resource logic.
- `npm run typecheck`

Notes:

- `auth/forms.ts` was reduced from about 2900 lines to the auth-only form handlers and helpers.
- `tests/server/routeArchitecture.test.ts` now guards against reintroducing chatroom or practice module logic into `auth/forms.ts`.

### 2.4 Split Domain Routers

- [x] Create route modules for auth, profiles, practice modules, chatrooms, payments, legal, progress, and superadmin.
- [x] Mount routers from `server.ts`.
- [x] Keep middleware ordering unchanged, especially Stripe raw body, URL encoding, CSRF, session loading, and onboarding redirects.

Verification:

- `npm run typecheck`
- `npm test`
- Manual smoke of representative routes.

Notes:

- New route modules were added for auth, chat, chatrooms, legal, payments, practice modules, profiles, progress, and settings.
- `superadmin/routes.ts` now exports `superadminRouter`.
- `server.ts` now mounts routers after global middleware and keeps Stripe webhook raw body handling before URL encoding.
- `tests/server/routeArchitecture.test.ts` verifies the critical middleware ordering.
- Local PM2 HTTP smoke on `http://127.0.0.1:5005` returned `200` for `/`, `/login`, and `/signup`, and expected `302` redirects for anonymous protected routes.

## Phase 3: UI And Styling Cleanup

### 3.1 Replace Misleading Shared Class Names

- [x] Introduce a neutral shared layout class for resource pages.
- [x] Replace non-practice-module uses of `practice-modules-view`.
- [x] Keep domain-specific classes only where the page has domain-specific styling.

Verification:

- `rg "practice-modules-view" views src/client/styles` returns no results.
- Visual smoke on credits, progress, profiles, settings, chatrooms, and practice modules.

Notes:

- Shared resource pages now use `app-resource-view` and `resource-page-*` classes.
- The practice module library has an explicit `practice-modules-page` class and `data-resource-layout` state for list/card styling.
- `tests/server/uiClassArchitecture.test.ts` guards against reintroducing the misleading shared class names.

### 3.2 Organize CSS By Responsibility

- [x] Identify reusable app shell styles.
- [x] Identify resource list/detail styles.
- [x] Identify tutor block and exercise card styles.
- [x] Move styles in small batches without visual redesign.

Verification:

- `npm run build:client`
- Visual smoke on desktop and mobile widths.

Notes:

- `app-shell.css` now focuses on the app shell, conversation panel, chat layout, translator, and user menu.
- `resource-pages.css` contains shared resource page containers, headers, forms, card menus, and profile-list helpers.
- `practice-modules.css` contains the practice module library, module cards, module forms, module markdown, and module-specific helpers.
- Tutor block and exercise card styles remain in `chat-content.css`; composer styles remain in `composer.css`.

### 3.3 Align Custom Styling With Flatly

- [x] Review custom gradients, shadows, and color tokens.
- [x] Remove or reduce styles that duplicate Bootstrap/Bootswatch behavior.
- [x] Keep app-specific tutor/exercise styling where Bootstrap has no equivalent.

Verification:

- Main pages still read as Bootswatch Flatly.
- Buttons, alerts, cards, nav, modals, and forms use Bootstrap semantics.

Notes:

- Touched shared resource and practice-module styles now use Bootstrap variables such as `--bs-secondary-color`, `--bs-border-radius`, and `--bs-box-shadow-sm`.
- Letter spacing in client CSS was normalized to `0`.
- App-specific tutor, exercise, chatroom, and composer styling was preserved where Bootstrap does not provide an equivalent interaction pattern.

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
