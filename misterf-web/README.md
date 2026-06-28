# Mister F Web

Mister F is a web app for Spanish-speaking learners practicing English with an
AI tutor. It is also intended to support human teachers who want students to
practice class topics with structured AI-assisted feedback. V1 includes:

- Tutor conversations with structured exercise blocks and visible tutor plans.
- Learner profiles, model tiers, progress summaries, and tutor reports.
- Reusable practice guides, assignments, resource folders, and the unified
  resource catalog.
- Account auth, email verification, password reset, Google OAuth, and
  superadmin access.
- Stripe Checkout credit purchases backed by managed OpenRouter user keys.
- Share/import flows for supported resources.
- Client critical-error telemetry and structured server runtime logs.

Teacher-facing work includes shareable assignments where a human teacher uses
an AI-assisted authoring workflow to create and revise a quiz-like practice
sequence, students complete it individually, AI evaluates the attempt for free
to the student, and students can then create an account to save progress or
continue with Mr. F under the standard credit policy.

## Stack

- Node.js, Express, TypeScript, and EJS
- Bootstrap, Bootswatch Flatly, Bootstrap Icons, and small project CSS
- Socket.IO for tutor realtime flows
- SQLite with project migrations
- AI SDK with OpenRouter
- Stripe Checkout for paid credits
- SMTP email for verification and password reset

## Setup

From a fresh clone:

```bash
cd misterf-web
npm ci
cp .env.example .env.development
```

Set at least:

- `APP_SESSION_SECRET`: at least 32 random characters.
- `APP_BASE_URL`: local app URL, normally `http://localhost:5005`.
- `OPENROUTER_API_KEY` or managed OpenRouter user-key settings for live LLM
  calls.
- SMTP settings if you want real verification/password-reset email.
- Stripe settings if you want to test paid credits locally.

Start the server:

```bash
npm run dev
```

Open:

```text
http://localhost:5005
```

For client bundle watch mode in a second terminal:

```bash
npm run dev:client
```

`public/build` is committed, so a fresh checkout can render existing client
assets before you start changing client code.

## Environment Files

Runtime config is loaded from:

- `.env.development` by default.
- `.env.production` when `NODE_ENV=production`.
- the file named by `ENV_FILE` when explicitly set.

`NODE_ENV` and `ENV_FILE` are startup controls. Set them from the shell, PM2, or
the deployment environment instead of relying on a value inside the file they
are meant to select.

Important variables:

- `HOST`: bind host. Defaults to `0.0.0.0` in development and `127.0.0.1` in
  production.
- `PORT`: HTTP port. Defaults to `3000`.
- `APP_BASE_URL`: public app URL used for cookies, OAuth callbacks, share URLs,
  Stripe redirects, and provider metadata.
- `APP_SESSION_SECRET`: required; must be at least 32 characters.
- `DATABASE_PATH`: SQLite path. Defaults to `./data/misterf.sqlite`.
- `LOG_LEVEL`: `debug`, `info`, `warn`, or `error`. Defaults to `debug` in
  development and `info` in production.
- `LLM_TRACE_MODE`: `metadata`, `full`, or `off`. Defaults to `full` in
  development and `metadata` in production.
- `LLM_TRACE_FULL_USER_IDS`, `LLM_TRACE_FULL_CONVERSATION_IDS`: comma-separated
  selectors for targeted full LLM traces while the default mode stays
  `metadata`.
- `LLM_MODEL`: optional fallback model id used when tier-specific model ids are
  not set.
- `LLM_MODEL_REGULAR`, `LLM_MODEL_ADVANCED`, `LLM_MODEL_MAX`: OpenRouter model
  ids by profile tier.
- `LLM_CONTEXT_WINDOW`: fallback context window for model metadata.
- `OPENROUTER_API_KEY`: fallback app-level OpenRouter key.
- `OPENROUTER_MANAGEMENT_API_KEY`: required to provision managed OpenRouter user
  keys.
- `OPENROUTER_KEY_ENCRYPTION_SECRET`: encrypts stored managed keys; falls back
  to `APP_SESSION_SECRET`.
- `OPENROUTER_USER_KEY_LIMIT_USD`: default managed user-key limit.
- `OPENROUTER_USER_KEY_LIMIT_RESET`: optional reset policy: `daily`, `weekly`,
  `monthly`, or blank.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_CREDITS_200_PRICE_ID`: required for paid credits and signed Stripe
  webhook fulfillment.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`,
  `RESEND_SMTP_API_KEY`, `MAIL_FROM`: required for outgoing email.
  `RESEND_SMTP_API_KEY` is accepted as a fallback for `SMTP_PASSWORD`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional Google OAuth login.
- `SUPERADMIN_EMAIL`: enables superadmin routes for that verified user.

Do not commit real `.env.development`, `.env.production`, synced production
databases, downloaded production backups, or local database backups.

## Scripts

- `npm run dev`: run the server with `tsx watch`.
- `npm run dev:client`: watch and rebuild client assets.
- `npm run build`: build server and client assets.
- `npm run build:server`: compile TypeScript into `dist`.
- `npm run build:client`: clean stale client build output, build Vite bundles,
  and update generated EJS asset partials.
- `npm start`: run the compiled server from `dist`.
- `npm run typecheck`: run TypeScript checks without emitting.
- `npm run test:typecheck`: typecheck tests.
- `npm test`: run Vitest.
- `npm run sync-prod-to-dev`: replace the local development database with a
  production backup. Requires `-- --replace-local`.
- `npm run pm2:start`: build and start/restart PM2 using the default
  environment.
- `npm run pm2:restart`: build and restart PM2 using the default environment.
- `npm run pm2:start:prod`: build and start/restart PM2 with
  `NODE_ENV=production`.
- `npm run pm2:restart:prod`: build and restart PM2 with `NODE_ENV=production`.
- `npm run pm2:status`: show PM2 status.
- `npm run pm2:stop`: stop the PM2 app.
- `npm run pm2:delete`: delete the PM2 app.
- `npm run pm2:logs`: show PM2 logs.

## Database And Migrations

The default database path is:

```text
./data/misterf.sqlite
```

Migrations run automatically when the server starts. You can also run them
directly after building the server:

```bash
npm run build:server
ENV_FILE=/dev/null DATABASE_PATH=./data/misterf.sqlite node dist/server/db/migrateCli.js
```

The V1 baseline uses a single `create_current_schema` migration for fresh
installs. After that baseline ships, schema changes must be added as new
forward-only migrations with new ids.

Migration guardrails:

- Review `src/server/db/migrations.ts` before changing persisted data behavior.
- Do not rewrite already-applied migrations after production data exists.
- Add or update migration tests when schema changes.
- Test fresh migrations and, when relevant, upgrade paths from existing
  production-shaped databases.
- For production-shaped rehearsal, sync production data locally first.

See:

- [Data Model](../docs/architecture/data-model.md)
- [Sync Production To Development](../docs/operations/sync-production-to-development.md)

## OpenRouter, Credits, And Stripe

Mister F uses OpenRouter for LLM calls. Authenticated users can receive managed
OpenRouter user keys, and the app derives displayed credits from the remaining
OpenRouter balance.

Paid credits use Stripe Checkout:

1. The server creates a Checkout Session for the fixed credits package.
2. Stripe redirects the user back to Mister F.
3. Stripe sends a signed webhook to `/stripe/webhook`.
4. The server fulfills the Checkout Session idempotently and updates the managed
   OpenRouter user-key limit.
5. The credits page shows fulfilled purchases only.

If Stripe variables are blank in development, paid checkout and webhook handling
are effectively unavailable and the product surfaces configuration errors
instead of silently granting credits.

See:

- [Payments Feature Notes](../docs/features/payments.md)
- [Credit And Payment Guardrails](../docs/issues/v1-llm-credit-payment-guardrails.md)

## Runtime Logging

Server runtime logs are structured JSON events emitted through
`src/server/services/logger.ts`.

Production defaults:

- `LOG_LEVEL=info`
- `LLM_TRACE_MODE=metadata`

Development defaults:

- `LOG_LEVEL=debug`
- `LLM_TRACE_MODE=full`

Production logs include important errors, frontend critical errors, Stripe credit
events, credit exhaustion UI events, malformed LLM responses, structured repair
requests, and tutor block repairs. Full LLM traces should be enabled only for
local debugging or short targeted investigations.

See:

- [Runtime Logging Policy](../docs/operations/runtime-logging-policy.md)
- [Client Error Telemetry](../docs/operations/client-error-telemetry.md)

## Build Artifacts And Deployment

`dist` and `public/build` are intentionally committed for the current V1 deploy
workflow. The production server can run committed build artifacts without
building on the machine.

When source or client assets change, build locally and commit the generated
output:

```bash
npm run build
```

The PM2 npm scripts run `npm run build` before starting or restarting. On a
lightweight production server where built artifacts are already deployed, use PM2
directly:

```bash
pm2 startOrRestart ecosystem.config.cjs --env production --update-env
```

Persist PM2 process state on the server:

```bash
pm2 save
pm2 startup
```

The production PM2 app is configured in `ecosystem.config.cjs`.

## Sync Production Data To Development

To replace the local development database with a production backup:

```bash
npm run sync-prod-to-dev -- --replace-local
```

The script creates a SQLite `.backup` on the production host, downloads it into
`tmp/prod-db-sync/`, backs up the current local database, replaces the local
database, and runs local migrations.

The synced database is sensitive production data. Do not commit it.

See:

- [Sync Production To Development](../docs/operations/sync-production-to-development.md)

## Verification Before Release

Before shipping changes, run:

```bash
npm ci --dry-run
npm run typecheck
npm run test:typecheck
npm test
npm run build
```

For database-sensitive changes, also run a fresh SQLite migration check:

```bash
tmpdir="$(mktemp -d)"
touch "$tmpdir/empty.env"
ENV_FILE="$tmpdir/empty.env" DATABASE_PATH="$tmpdir/misterf.sqlite" node dist/server/db/migrateCli.js
rm -rf "$tmpdir"
```

For runtime changes, start or restart the app locally and smoke-test at least:

- `/health`
- `/login`
- an unauthenticated protected route redirect, such as `/credits`
- a generated client asset under `/public/build`

## Documentation

Start with:

- [Documentation Index](../docs/README.md)
- [System Overview](../docs/architecture/system-overview.md)
- [Architecture](../docs/architecture/architecture.md)
- [Feature Flows](../docs/architecture/feature-flows.md)
- [Teacher-Assigned Practice](../docs/features/teacher-assigned-practice.md)
- [Prompts](../docs/architecture/prompts.md)
- [Testing](../docs/architecture/testing.md)
- [Tutor Runtime](../docs/tutor/runtime.md)
- [V1 Project Cleanup Audit](../docs/issues/v1-project-cleanup-audit.md)
- [V1 Project Cleanup Tracker](../docs/issues/v1-project-cleanup-tracker.md)
