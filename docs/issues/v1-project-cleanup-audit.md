# V1 Project Cleanup Audit

Date: 2026-06-15

This audit reviews the project before closing a first production-ready version. It covers code structure, database state, styling, generated assets, dependencies, test coverage, and accumulated contradictions.

## Executive Summary

The project is close to a functional v1. The current checks pass:

- `npm run typecheck`
- `npm run test:typecheck`
- `npm test`
- `npm run build:client`

The existing automated tests now include fresh database migration coverage and structured tutor response contracts. They do not yet cover web routes, payments, auth, chatroom flows, or full UI smoke paths.

The main v1 risks are:

- **Resolved critical:** fresh installation migrations were broken and are now covered by `tests/db/migrations.test.ts`.
- **High:** empty database files and temporary artifacts are tracked despite ignore rules.
- **High:** the migration from an old monolithic controller to domain handlers is incomplete.
- **Medium:** CSS and class names mix unrelated domains, making UI cleanup fragile.
- **Medium:** `public/build` contains many stale hashed assets.
- **Medium:** LLM credit gating exists at important edges, but there is no automated guardrail to prevent future ungated LLM calls.

## Verification Performed

From `misterf-web/`:

- `npm run typecheck`: passed.
- `npm run test:typecheck`: passed.
- `npm test`: passed, 5 files and 16 tests.
- `npm run build:client`: passed.
- Fresh SQLite migration test with a temporary `DATABASE_PATH`: passed after the v1 baseline migration reset.

## Findings

### 1. Fresh Database Migrations Were Broken

**Severity:** Critical

**Status:** Resolved for the v1 baseline on 2026-06-15. Fresh installs now use a single `create_current_schema` migration and `tests/db/migrations.test.ts` verifies that an empty SQLite database can migrate successfully.

A new database cannot apply the full migration list. Migration `id: 1` is named `create_current_schema`, but it already creates objects that later migrations attempt to create again.

Evidence:

- `misterf-web/src/server/db/migrations.ts:9` defines `id: 1`, `create_current_schema`.
- `misterf-web/src/server/db/migrations.ts:251` creates `conversation_chat_room_report_snapshots`.
- `misterf-web/src/server/db/migrations.ts:527` creates `conversation_chat_room_report_snapshots` again.
- A fresh migration test fails with `table conversation_chat_room_report_snapshots already exists`.

Additional indicators:

- Migration ids jump from `1` to `5` at `misterf-web/src/server/db/migrations.ts:317`.
- The initial migration contains chatroom/report references before later incremental migrations create those resources.
- `profiles` is created without `model_tier`, `learning_context`, and `profile_onboarding_completed_at`, then later altered in migrations `12` and `17`. That is valid for a historical migration, but conflicts with the `create_current_schema` name.

Resolution:

The project chose a v1 baseline strategy: `id: 1` is the current schema bootstrap for fresh installs. After this baseline ships, production-era schema changes must be new forward-only migrations with new ids.

### 2. Empty Database Files Are Tracked

**Severity:** High

Two empty database files are versioned:

- `misterf-web/data.sqlite`
- `misterf-web/data/app.db`

Both are `0B`, reported as `empty`, and are not the configured default database path. The default path is `./data/misterf.sqlite`.

Evidence:

- `misterf-web/.gitignore:7` ignores `data/*.sqlite`.
- `misterf-web/.gitignore:8` ignores `data/*.sqlite-*`.
- `git ls-files` includes `misterf-web/data.sqlite` and `misterf-web/data/app.db`.
- `env.databasePath` defaults to `./data/misterf.sqlite` in `misterf-web/src/server/config/env.ts:42`.

Recommendation:

Remove the empty database files from the repo and extend `.gitignore` to cover generated SQLite and DB files:

- `data/*.db`
- `data/*.db-*`
- optionally root-level `*.sqlite` if root database files should never be committed.

### 3. The Controller Split Is Incomplete

**Severity:** High

The app already has domain-specific handlers for chat, chatrooms, practice modules, profiles, payments, and progress. However, `server.ts` still imports practice module, profile, sharing, archive, restore, and resource actions from `auth/forms.ts`.

Evidence:

- `misterf-web/src/server/server.ts:6` through `misterf-web/src/server/server.ts:43` import many non-auth handlers from `./auth/forms.js`.
- `misterf-web/src/server/practiceModules/handlers.ts:512` already renders the practice module list page.
- `misterf-web/src/server/practiceModules/handlers.ts:520` already handles generated practice module drafts.
- `misterf-web/src/server/auth/forms.ts` has 2907 lines and still contains legacy non-auth page modeling from around `misterf-web/src/server/auth/forms.ts:820`.

Impact:

- It is unclear which handler is the source of truth for several routes.
- Auth changes and resource changes remain coupled.
- This conflicts with the project guidance that each page or route should have its own dedicated handler.

Recommendation:

Finish the extraction:

- Move remaining practice module actions from `auth/forms.ts` to `practiceModules/handlers.ts`.
- Move remaining profile actions from `auth/forms.ts` to `profiles/handlers.ts`.
- Keep `auth/forms.ts` focused on login, signup, password, verification, and session flows.
- Remove unused legacy render/model helpers after the route imports no longer depend on them.

### 4. The Central Router Has Too Much Responsibility

**Severity:** Medium-High

`server.ts` works, but it owns global middleware, static vendor configuration, all HTTP routes, socket registration, migration startup, and the listener.

Evidence:

- `misterf-web/src/server/server.ts:130` through `misterf-web/src/server/server.ts:150` configure static vendor routes.
- `misterf-web/src/server/server.ts:157` through `misterf-web/src/server/server.ts:254` register nearly the full HTTP surface.

Recommendation:

Create route modules by domain:

- `auth/routes.ts`
- `profiles/routes.ts`
- `practiceModules/routes.ts`
- `chatrooms/routes.ts`
- `payments/routes.ts`
- `legal/routes.ts`
- `progress/routes.ts`
- `superadmin/routes.ts`

Then keep `server.ts` as infrastructure composition: config, middleware, static assets, route mounting, sockets, and `listen`.

### 5. Domain-Specific CSS Classes Are Reused Across Unrelated Pages

**Severity:** Medium

Several pages use `practice-modules-view` even when they are not practice module pages.

Evidence:

- `misterf-web/views/credits.ejs:32`
- `misterf-web/views/progress.ejs:23`
- `misterf-web/views/profiles-form.ejs:3`
- `misterf-web/views/settings.ejs:3`
- `misterf-web/views/chatrooms-list.ejs:3`
- `misterf-web/views/change_password.ejs:3`

Impact:

A practice module style change can accidentally alter credits, progress, profiles, settings, and chatrooms. The HTML also becomes harder to reason about semantically.

Recommendation:

Introduce a neutral shared layout class such as `resource-view`, `app-resource-view`, or `app-section-view`. Keep domain classes only for real domain-specific differences such as `practice-modules-page`, `chatrooms-page`, and `progress-page`.

### 6. Custom CSS Has Grown Into a Parallel System

**Severity:** Medium

The project uses Bootswatch Flatly, but there are 3420 lines of custom CSS:

- `src/client/styles/chat-content.css`: 1687 lines.
- `src/client/styles/app-shell.css`: 1120 lines.
- `src/client/styles/chatrooms.css`: 210 lines.
- `src/client/styles/composer.css`: 164 lines.

Some of this is justified by rich tutor blocks and exercises, but the CSS now contains many custom colors, gradients, shadows, z-index values, and panel treatments.

Evidence:

- Custom variables in `misterf-web/src/client/styles/base.css:11` through `misterf-web/src/client/styles/base.css:53`.
- Gradient page background in `misterf-web/src/client/styles/base.css:64`.
- Custom app panels in `misterf-web/src/client/styles/app-shell.css:43`.
- Many exercise card treatments in `misterf-web/src/client/styles/chat-content.css`.

Recommendation:

Do not rewrite the UI before v1. Prefer a safe cleanup:

- Keep Bootstrap and Bootswatch Flatly as the default visual language.
- Name indispensable custom tokens clearly.
- Split CSS by real component responsibility: shell, resource lists, tutor blocks, exercise cards, composer.
- Reduce selectors that rely on incorrect domain names.

### 7. Generated Build Artifacts Have Accumulated

**Severity:** Medium

`public/build/entries` contains many stale hashed versions of `chat`, `chatrooms`, and `practice-modules` bundles. The current build points to only a few generated entry files through `views/partials/*-client-script.ejs`.

Evidence:

- `git ls-files public/build views/partials` lists 152 files.
- There are many historical `public/build/entries/chat-*.js`, `chatrooms-*.js`, and `practice-modules-*.js` files.
- `npm run build:client` regenerates the current partials and stylesheet via `misterf-web/scripts/build-client.mjs`.

Impact:

- Noisy diffs and reviews.
- Risk of inspecting or serving stale assets by mistake.
- Larger and less understandable repository.

Recommendation:

Choose a build artifact policy:

- If production builds on the server, stop tracking generated `public/build` files except non-generated static assets.
- If deployment requires committed assets, clean stale JS entries before each build and commit only current manifest, partials, and current assets.

The current script cleans old CSS files, but not old JS entry files.

### 8. Test Coverage Is Too Narrow For A V1 Freeze

**Severity:** Medium

The existing tests pass, but they focus on `llmTutor`. Missing coverage includes:

- Fresh migrations.
- Local and Google auth happy/error paths.
- CSRF behavior on critical forms.
- Practice module CRUD and sharing.
- Chatroom CRUD, conversation, and report flows.
- Stripe checkout/webhook idempotency.
- Credit gating for every LLM entry point.
- Main EJS page render smoke tests.

Evidence:

- The only test files found are under `tests/llmTutor/*.test.ts`.
- The fresh migration failure was not caught by the test suite.

Recommendation:

Before v1, add a compact high-value regression suite:

- Fresh migration test.
- Main route render smoke tests with a fake or seeded user.
- Credit gate contract test for LLM entry points.
- Stripe webhook idempotency test.

### 9. LLM Credit Gating Exists, But Needs An Automated Guardrail

**Severity:** Medium

Important user-facing LLM paths fetch an API key through `getCreditCheckedOpenRouterApiKeyForUser`:

- Practice module draft: `misterf-web/src/server/practiceModules/handlers.ts:537`.
- Chatroom draft: `misterf-web/src/server/chatrooms/handlers.ts:740`.
- Chatroom report module generation: `misterf-web/src/server/chatrooms/handlers.ts:1365`.
- Tutor socket: `misterf-web/src/server/socket/chatSocket.ts:1320`.
- Chatroom tool report generation: `misterf-web/src/server/services/llmTutor/chatRoomTools.ts:264`.

Many services call `generateText` directly. That is acceptable if services only accept already-gated keys, but there is no automated check enforcing that boundary.

Recommendation:

Add a static or contract test:

- Handlers and socket entry points must obtain `openRouterApiKey` through `creditGate`.
- LLM services should not read `env.openrouterApiKey` directly except through the documented provider fallback.
- Credit exhaustion must render product UI or emit product socket events, never raw stack traces.

### 10. Development Logging Leaks Into Runtime

**Severity:** Low-Medium

There are several `console.log`, `console.info`, and `console.error` calls. Some are normal server logs, but others print LLM response details or auth return metadata.

Evidence:

- `misterf-web/src/client/chat/app/ChatRuntime.js:251` logs from the browser.
- `misterf-web/src/server/auth/forms.ts:245` logs `[auth returnTo]`.
- `misterf-web/src/server/services/llmTutor/index.ts:399` logs repaired response blocks.
- `misterf-web/src/server/services/llmTutor/index.ts:496` logs translator response metadata.
- `misterf-web/src/server/services/llmTutor/logging.ts:13` logs full formatted payloads.

Recommendation:

Introduce an environment-aware logger:

- `debug` only in development.
- `info` for operational events without learner content or secrets.
- `warn`/`error` with redaction for learner content and LLM output.

### 11. Documentation Is Partially Outdated

**Severity:** Low-Medium

The README still describes the app as a simple English sentence-writing tutor. The product now includes profiles, chatrooms, reports, progress, credits, sharing, and practice modules. `TODO.txt` also lists some progress ideas as future work even though progress tables and the `/progress` page exist.

Evidence:

- `misterf-web/README.md` has a much narrower product description than the current app.
- `TODO.txt` mentions global progress as future work.
- `docs/architecture/data-model.md` is more current than README and TODO.

Recommendation:

Update README as the v1 operating guide. Convert `TODO.txt` into a curated backlog or retire it if `docs/issues` becomes the source of truth for debt.

### 12. Temporary And System Files Need Cleanup

**Severity:** Low

Local and temporary files are present:

- `.tmp-chatrooms-auth.html` is tracked.
- `misterf-web/src/server/services/.DS_Store` appears as ignored local junk.
- `misterf-web/.DS_Store` appears as ignored local junk.

Recommendation:

Remove `.tmp-chatrooms-auth.html` from the repo if it is not an intentional fixture. Keep `.DS_Store` ignored and remove local copies.

## Strengths

- The newer domain split is moving in the right direction: `chat/handlers.ts`, `chatrooms/handlers.ts`, `practiceModules/handlers.ts`, `profiles/handlers.ts`, and `payments/handlers.ts`.
- Tutor prompts and block protocols are documented and tested.
- Zod schemas protect many structured LLM responses.
- Reviewed LLM entry points generally pass through the credit gate.
- Architecture documentation already exists under `docs/architecture`.

## Recommended Plan

### Phase 0: Freeze And Protect V1

1. Create a stabilization branch.
2. Add a fresh migration test and make it pass.
3. Add minimal server/route smoke tests.
4. Document the real dev/prod environment variables.

### Phase 1: Blocking Cleanup

1. Fix `migrations.ts` so a fresh SQLite database migrates without error.
2. Remove `misterf-web/data.sqlite`, `misterf-web/data/app.db`, and `.tmp-chatrooms-auth.html` if they are not intentional fixtures.
3. Extend `.gitignore` for generated SQLite/DB files and real temporary artifacts.
4. Define the `public/build` policy and remove stale hashed assets.

### Phase 2: Architecture Cleanup Without Product Changes

1. Move non-auth handlers out of `auth/forms.ts`.
2. Split `server.ts` into domain routers.
3. Split `repository.ts` by domain only with tests around the affected behavior.
4. Keep temporary wrapper exports only when needed to avoid large risky PRs.

### Phase 3: UI Cleanup

1. Replace `practice-modules-view` with a neutral shared layout class.
2. Split CSS by real component responsibility.
3. Review main screens on desktop and mobile.
4. Keep Bootswatch Flatly as the visual baseline.

### Phase 4: AI And Payments Guardrails

1. Add credit gate tests or static checks around LLM entry points.
2. Add Stripe webhook idempotency coverage.
3. Review runtime logs for sensitive content.
4. Document credit flow and credit-exhausted errors.

### Phase 5: Final Documentation

1. Update README as the v1 operation guide.
2. Update or retire `TODO.txt`.
3. Keep this audit and the tracker as the cleanup source of truth.
