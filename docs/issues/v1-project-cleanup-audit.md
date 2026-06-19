# V1 Project Cleanup Audit

Date: 2026-06-15

This audit reviews the project before closing a first production-ready version. It covers code structure, database state, styling, generated assets, dependencies, test coverage, and accumulated contradictions.

## Executive Summary

The project is close to a functional v1. The current checks pass:

- `npm run typecheck`
- `npm run test:typecheck`
- `npm test`
- `npm run build:client`

The existing automated tests now include fresh database migration coverage, anonymous main route smoke coverage, and structured tutor response contracts. They do not yet cover authenticated web workflows, payments, chatroom flows, or full browser-level UI smoke paths.

The remaining main v1 risks are:

- **Resolved critical:** fresh installation migrations were broken and are now covered by `tests/db/migrations.test.ts`.
- **Resolved high:** the migration from the old monolithic controller to domain handlers is now complete for Phase 2.
- **Medium:** CSS and class names mix unrelated domains, making UI cleanup fragile.
- **Medium:** LLM credit gating exists at important edges, but there is no automated guardrail to prevent future ungated LLM calls.

## Verification Performed

From `misterf-web/`:

- `npm run typecheck`: passed.
- `npm run test:typecheck`: passed.
- `npm test`: passed, 7 files and 27 tests.
- `npm run build:client`: passed.
- Fresh SQLite migration test with a temporary `DATABASE_PATH`: passed after the v1 baseline migration reset.
- Local PM2 HTTP smoke on `http://127.0.0.1:5005`: public routes returned `200`, and anonymous protected routes returned expected `302` redirects.

## Findings

### 1. Fresh Database Migrations Were Broken

**Severity:** Critical

**Status:** Resolved for the v1 baseline on 2026-06-15. Fresh installs now use a single `create_current_schema` migration and `tests/db/migrations.test.ts` verifies that an empty SQLite database can migrate successfully.

A new database cannot apply the full migration list. Migration `id: 1` is named `create_current_schema`, but it already creates objects that later migrations attempt to create again.

Original evidence:

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

**Status:** Resolved on 2026-06-15. The empty tracked files were removed, and ignore rules now cover generated SQLite and DB files.

Two empty database files are versioned:

- `misterf-web/data.sqlite`
- `misterf-web/data/app.db`

Both are `0B`, reported as `empty`, and are not the configured default database path. The default path is `./data/misterf.sqlite`.

Evidence:

- `misterf-web/.gitignore:7` ignores `data/*.sqlite`.
- `misterf-web/.gitignore:8` ignores `data/*.sqlite-*`.
- `git ls-files` included `misterf-web/data.sqlite` and `misterf-web/data/app.db`.
- `env.databasePath` defaults to `./data/misterf.sqlite` in `misterf-web/src/server/config/env.ts:42`.

Resolution:

Removed the empty files from version control:

- `misterf-web/data.sqlite`
- `misterf-web/data/app.db`

Updated ignore rules to cover:

- root-level `data.sqlite` in `misterf-web`
- generated `data/*.sqlite`
- generated `data/*.db`
- SQLite sidecar files

### 3. The Controller Split Was Incomplete

**Severity:** High

**Status:** Resolved on 2026-06-15. Practice module and profile mutations now live in their domain handlers, and `auth/forms.ts` is scoped to authentication form flows.

The app already has domain-specific handlers for chat, chatrooms, practice modules, profiles, payments, and progress. Previously, `server.ts` still imported practice module, profile, sharing, archive, restore, and resource actions from `auth/forms.ts`.

Original evidence:

- `misterf-web/src/server/server.ts:6` through `misterf-web/src/server/server.ts:43` import many non-auth handlers from `./auth/forms.js`.
- `misterf-web/src/server/practiceModules/handlers.ts:512` already renders the practice module list page.
- `misterf-web/src/server/practiceModules/handlers.ts:520` already handles generated practice module drafts.
- `misterf-web/src/server/auth/forms.ts` has 2907 lines and still contains legacy non-auth page modeling from around `misterf-web/src/server/auth/forms.ts:820`.

Impact:

- It is unclear which handler is the source of truth for several routes.
- Auth changes and resource changes remain coupled.
- This conflicts with the project guidance that each page or route should have its own dedicated handler.

Recommendation:

Completed extraction:

- Practice module create/update/archive/restore/delete/favorite/share handlers moved to `src/server/practiceModules/handlers.ts`.
- Profile create/update/switch handlers moved to `src/server/profiles/handlers.ts`.
- `auth/forms.ts` now keeps login, signup, forgot/reset password, change password, email verification, logout, and session helpers.
- `tests/server/routeArchitecture.test.ts` verifies that chatroom and practice module logic does not return to `auth/forms.ts`.

### 4. The Central Router Had Too Much Responsibility

**Severity:** Medium-High

**Status:** Resolved on 2026-06-15. HTTP routes are now grouped into domain routers and mounted from `server.ts`.

`server.ts` still owns infrastructure composition, global middleware, static vendor configuration, socket registration, migration startup, and the listener. It no longer owns the full HTTP route table directly.

Original evidence:

- `misterf-web/src/server/server.ts:130` through `misterf-web/src/server/server.ts:150` configure static vendor routes.
- `misterf-web/src/server/server.ts:157` through `misterf-web/src/server/server.ts:254` register nearly the full HTTP surface.

Recommendation:

Completed route split:

- `auth/routes.ts`
- `chat/routes.ts`
- `profiles/routes.ts`
- `practiceModules/routes.ts`
- `chatrooms/routes.ts`
- `payments/routes.ts`
- `legal/routes.ts`
- `progress/routes.ts`
- `settings/routes.ts`
- `superadmin/routes.ts`

`server.ts` now mounts those routers after global middleware. Stripe webhook raw body handling still runs before URL encoding, CSRF, session loading, and onboarding redirects.

### 5. Domain-Specific CSS Classes Are Reused Across Unrelated Pages

**Severity:** Medium

**Status:** Resolved on 2026-06-18. Shared resource pages now use
`app-resource-view` and `resource-page-*` classes. The practice module library
uses the domain-specific `practice-modules-page` class only where module-specific
styling is needed.

Several pages previously used `practice-modules-view` even when they were not
practice module pages.

Evidence:

- `misterf-web/views/credits.ejs:32`
- `misterf-web/views/progress.ejs:23`
- `misterf-web/views/profiles-form.ejs:3`
- `misterf-web/views/settings.ejs:3`
- `misterf-web/views/chatrooms-list.ejs:3`
- `misterf-web/views/change_password.ejs:3`

Impact:

A practice module style change can accidentally alter credits, progress, profiles, settings, and chatrooms. The HTML also becomes harder to reason about semantically.

Resolution:

Implemented neutral shared classes and a static guard:

- Resource containers use `app-resource-view`.
- Shared page pieces use `resource-page-*`.
- The practice module library uses `practice-modules-page` for its own layout-state styles.
- `tests/server/uiClassArchitecture.test.ts` prevents the old misleading class names from returning.

### 6. Custom CSS Has Grown Into a Parallel System

**Severity:** Medium

**Status:** Partially resolved on 2026-06-18. CSS is now split by clearer
responsibility, and touched shared styles lean on Bootstrap/Bootswatch variables.
The tutor and exercise surfaces still intentionally keep custom CSS because they
have interactions Bootstrap does not provide.

The project uses Bootswatch Flatly, but there were 3420 lines of custom CSS
before the Phase 3 cleanup:

- `src/client/styles/chat-content.css`: 1687 lines.
- `src/client/styles/app-shell.css`: 1120 lines, reduced to 629 lines.
- `src/client/styles/resource-pages.css`: 158 lines after extraction.
- `src/client/styles/practice-modules.css`: 312 lines after extraction.
- `src/client/styles/chatrooms.css`: 228 lines after moving chatroom-specific resource helpers.
- `src/client/styles/composer.css`: 164 lines.

Some of this is justified by rich tutor blocks and exercises, but the CSS now contains many custom colors, gradients, shadows, z-index values, and panel treatments.

Evidence:

- Custom variables in `misterf-web/src/client/styles/base.css:11` through `misterf-web/src/client/styles/base.css:53`.
- Gradient page background in `misterf-web/src/client/styles/base.css:64`.
- Custom app panels in `misterf-web/src/client/styles/app-shell.css:43`.
- Many exercise card treatments in `misterf-web/src/client/styles/chat-content.css`.

Resolution:

The UI was not redesigned. Instead, CSS ownership was clarified:

- `app-shell.css` now focuses on shell, navigation, conversation panel, translator, and user-menu behavior.
- `resource-pages.css` owns shared resource containers, headers, form shells, card menus, and profile-list helpers.
- `practice-modules.css` owns the module library, module cards, module forms, markdown, and module-specific helpers.
- `chat-content.css` remains the tutor block and exercise-card stylesheet.
- `composer.css` remains the composer stylesheet.
- Letter spacing in client CSS was normalized to `0`.

### 7. Generated Build Artifacts Have Accumulated

**Severity:** Medium

**Status:** Resolved on 2026-06-15. `public/build` remains committed by policy, but stale generated Vite output is cleaned before each client build.

`public/build/entries` contains many stale hashed versions of `chat`, `chatrooms`, and `practice-modules` bundles. The current build points to only a few generated entry files through `views/partials/*-client-script.ejs`.

Evidence:

- `git ls-files public/build views/partials` lists 152 files.
- There are many historical `public/build/entries/chat-*.js`, `chatrooms-*.js`, and `practice-modules-*.js` files.
- `npm run build:client` regenerates the current partials and stylesheet via `misterf-web/scripts/build-client.mjs`.

Impact:

- Noisy diffs and reviews.
- Risk of inspecting or serving stale assets by mistake.
- Larger and less understandable repository.

Resolution:

The project intentionally commits `public/build` so the lightweight production server does not need to build client assets during deployment.

`scripts/build-client.mjs` now removes stale generated Vite output before running `vite build`, while preserving non-generated brand assets. The committed build output should contain only the active manifest, current entry bundles, current shared chunks, current generated CSS, sourcemaps, and brand assets.

After cleanup, `public/build` contains 12 current files instead of the previous accumulated historical bundle set.

### 8. Test Coverage Is Still Too Narrow For A V1 Freeze

**Severity:** Medium

The existing tests pass and now cover fresh migrations, anonymous main route rendering, protected-route redirects, and `llmTutor` contracts. Missing coverage still includes:

- Local and Google auth happy/error paths.
- CSRF behavior on critical forms.
- Practice module CRUD and sharing.
- Chatroom CRUD, conversation, and report flows.
- Stripe checkout/webhook idempotency.
- Credit gating for every LLM entry point.
- Main EJS page render smoke tests.

Evidence:

- Fresh migration coverage exists in `misterf-web/tests/db/migrations.test.ts`.
- Main anonymous route smoke coverage exists in `misterf-web/tests/server/routes.test.ts`.
- Authenticated workflow, payment, and full feature-flow coverage is still missing.

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

**Status:** Resolved for tracked temporary artifacts on 2026-06-15. `.tmp-chatrooms-auth.html` was removed and root temporary artifacts are now ignored.

Original evidence:

- `.tmp-chatrooms-auth.html` was tracked.
- `misterf-web/src/server/services/.DS_Store` appears as ignored local junk.
- `misterf-web/.DS_Store` appears as ignored local junk.

Resolution:

`.tmp-chatrooms-auth.html` was not referenced by source, scripts, docs, or tests except as cleanup debt, so it was removed. The repository root now ignores `.tmp-*` and `.DS_Store`.

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
2. Keep `public/build` committed, but regenerate it locally before deploy so stale hashed assets do not accumulate.

### Phase 2: Architecture Cleanup Without Product Changes

1. Move non-auth handlers out of `auth/forms.ts`.
2. Split `server.ts` into domain routers.
3. Split `repository.ts` by domain only with tests around the affected behavior.
4. Keep temporary wrapper exports only when needed to avoid large risky PRs.

### Phase 3: UI Cleanup

1. Completed: replace `practice-modules-view` with neutral shared resource classes.
2. Completed: split resource page and practice module CSS out of `app-shell.css`.
3. Completed: add a static UI class architecture guard.
4. Keep Bootswatch Flatly as the visual baseline for future UI work.

### Phase 4: AI And Payments Guardrails

1. Completed on 2026-06-18: add credit gate tests and static checks around LLM entry points.
2. Completed on 2026-06-18: add Stripe webhook and fulfillment idempotency coverage.
3. Review runtime logs for sensitive content.
4. Completed on 2026-06-18: document credit flow and credit-exhausted errors in `docs/issues/v1-llm-credit-payment-guardrails.md`.

### Phase 5: Final Documentation

1. Update README as the v1 operation guide.
2. Update or retire `TODO.txt`.
3. Keep this audit and the tracker as the cleanup source of truth.
