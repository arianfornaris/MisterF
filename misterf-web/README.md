# Mister F Web

Mister F is a web app for English practice with an AI tutor. It supports tutor conversations, reusable practice modules, chat rooms with characters, learner profiles, progress reports, credits, sharing flows, and OpenRouter-backed LLM calls.

## Stack

- Node.js and Express
- TypeScript
- EJS
- Bootstrap, Bootswatch Flatly, and Bootstrap Icons
- Socket.IO
- SQLite with project migrations
- AI SDK with OpenRouter
- Stripe Checkout for credits
- SMTP email for verification and password reset

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.development
```

Set at least:

- `APP_SESSION_SECRET`: at least 32 random characters.
- `APP_BASE_URL`: local app URL, normally `http://localhost:5005`.
- `OPENROUTER_API_KEY` or configured managed user keys if you want live LLM calls.

Start the development server:

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

## Environment Files

Runtime config is loaded from:

- `.env.development` by default.
- `.env.production` when `NODE_ENV=production`.
- the file named by `ENV_FILE` when explicitly set.

`NODE_ENV` and `ENV_FILE` are startup controls. Set them from the shell, PM2, or deployment environment rather than relying on a value inside the file they are meant to select.

Important variables:

- `HOST`: bind host. Defaults to `0.0.0.0` in development and `127.0.0.1` in production.
- `PORT`: HTTP port. Defaults to `3000`.
- `APP_BASE_URL`: public app URL used for cookies, OAuth callbacks, share URLs, and provider metadata.
- `APP_SESSION_SECRET`: required; must be at least 32 characters.
- `DATABASE_PATH`: SQLite path. Defaults to `./data/misterf.sqlite`.
- `LLM_MODEL`: optional fallback model id used when tier-specific model ids are not set.
- `LLM_MODEL_REGULAR`, `LLM_MODEL_ADVANCED`, `LLM_MODEL_MAX`: OpenRouter model ids by profile tier.
- `LLM_CONTEXT_WINDOW`: fallback context window for model metadata.
- `OPENROUTER_API_KEY`: fallback app-level OpenRouter key.
- `OPENROUTER_MANAGEMENT_API_KEY`: required to provision managed OpenRouter user keys.
- `OPENROUTER_KEY_ENCRYPTION_SECRET`: encrypts stored managed keys; falls back to `APP_SESSION_SECRET`.
- `OPENROUTER_USER_KEY_LIMIT_USD`: default managed user key limit.
- `OPENROUTER_USER_KEY_LIMIT_RESET`: optional reset policy: `daily`, `weekly`, `monthly`, or blank.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CREDITS_200_PRICE_ID`: required for paid credits.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `RESEND_SMTP_API_KEY`, `MAIL_FROM`: required for outgoing email. `RESEND_SMTP_API_KEY` is accepted as a fallback for `SMTP_PASSWORD`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional Google OAuth login.
- `SUPERADMIN_EMAIL`: enables superadmin routes for that verified user.

Do not commit `.env.development`, `.env.production`, synced production databases, or local database backups.

## Scripts

- `npm run dev`: run the server with `tsx watch`.
- `npm run dev:client`: watch and rebuild client assets.
- `npm run build`: build server and client assets.
- `npm run build:server`: compile TypeScript into `dist`.
- `npm run build:client`: clean stale client build output, build Vite bundles, and update generated EJS asset partials.
- `npm start`: run the compiled server from `dist`.
- `npm run typecheck`: run TypeScript checks without emitting.
- `npm run test:typecheck`: typecheck tests.
- `npm test`: run Vitest.
- `npm run sync-prod-to-dev`: replace the local development database with a production backup. Requires `-- --replace-local`.
- `npm run pm2:start`: build and start/restart PM2 using the default environment.
- `npm run pm2:restart`: build and restart PM2 using the default environment.
- `npm run pm2:start:prod`: build and start/restart PM2 with `NODE_ENV=production`.
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

Migrations run automatically when the server starts. You can also run them directly after building the server:

```bash
npm run build:server
ENV_FILE=/dev/null DATABASE_PATH=./data/misterf.sqlite node dist/server/db/migrateCli.js
```

The v1 baseline uses a single `create_current_schema` migration for fresh installs. After that baseline ships, schema changes must be added as new forward-only migrations with new ids.

Migration guardrails:

- Review `src/server/db/migrations.ts` before changing persisted data behavior.
- Add or update migration tests when schema changes.
- Test fresh migrations with `npm test`.
- For production-shaped rehearsal, sync production data locally first.

See:

- `../docs/architecture/data-model.md`
- `../docs/operations/sync-production-to-development.md`

## Client Build Artifacts

`public/build` is intentionally committed. The production server is lightweight and should not need to build client assets during deploy.

Before deploying client changes, build locally and commit the generated output:

```bash
npm run build:client
```

The client build script removes stale Vite output before building, while preserving non-generated brand assets under `public/build/brand`.

## Sync Production Data To Development

To replace the local development database with a production backup:

```bash
npm run sync-prod-to-dev -- --replace-local
```

The script creates a SQLite `.backup` on the production host, downloads it into `tmp/prod-db-sync/`, backs up the current local database, replaces the local database, and runs local migrations.

The synced database is sensitive production data. Do not commit it.

See:

- `../docs/operations/sync-production-to-development.md`

## Production With PM2

Create `.env.production` on the production host and set production values for the required variables.

Build and start:

```bash
npm run pm2:start:prod
```

Restart after deploy:

```bash
npm run pm2:restart:prod
```

Persist PM2 process state:

```bash
pm2 save
pm2 startup
```

The production PM2 app is configured in `ecosystem.config.cjs`.

## Verification

Before shipping changes, run:

```bash
npm run typecheck
npm run test:typecheck
npm test
npm run build
```

For changes that affect runtime behavior, also smoke-test the relevant pages locally.
