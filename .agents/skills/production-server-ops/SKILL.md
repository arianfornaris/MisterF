---
name: production-server-ops
description: Use when connecting to the Mister F production server, deploying, running remote commands over SSH, setting or rotating production environment variables and secrets, restarting the app with pm2, or reading production logs. Covers the misterf.us topology from deploy.sh, the deploy flow, production restarts, where secrets live, and cautions for a live server and its database.
---

# Production Server Operations

The Mister F production app runs on a remote server. Learn the topology from
`deploy.sh` at the repo root rather than hardcoding assumptions.

## Topology

- Host: `arian@misterf.us` over SSH. A passwordless key is already configured;
  use `-o BatchMode=yes -o ConnectTimeout=10` so a missing key fails fast
  instead of hanging on a prompt (interactive prompts are not supported here).
- App directory on the server: `repos/MisterF/misterf-web`.
- Process manager: pm2, app name `misterf-web`, started from
  `ecosystem.config.cjs` with `--env production`. That sets
  `NODE_ENV=production`, so the app loads the server's `.env.production`.

## Running Remote Commands

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 arian@misterf.us "
cd repos/MisterF/misterf-web
<commands>
"
```

## Deploying Code

Prefer the repo's `deploy.sh` (run from the repo root). It:

- builds locally,
- refuses to deploy when there are uncommitted local changes,
- refuses to deploy when `HEAD` is not tagged with the `package.json` version
  (see the `versioning-and-releases` skill for the bump-and-tag steps),
- pushes git with `--follow-tags`,
- then on the server runs `git pull` and
  `pm2 restart ecosystem.config.cjs --only misterf-web --env production --update-env`.

It does not seed content — see "Seeding Content After A Deploy" below.

The server checks out the branch that `git pull` advances (currently `main`).
So the release must be on `main` before deploying — deploying from a feature
branch (e.g. `v3`) is a no-op (`Already up to date`). See `versioning-and-releases`
→ "Deploy Branch — Merge To main First": a request to deploy authorizes the
merge, so state what is going out with it and then merge, rather than stopping
to ask.

## Seeding Content After A Deploy

A deploy ships code and re-runs migrations on restart. It does **not** carry
content rows. Anything the product stores as data has to be written into each
environment once, on purpose.

Today that means the landing page's public example activities. They live as
hand-authored fixtures in `src/server/landing/demoActivities.ts`, and a seeder
writes them into a dedicated demo account:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 arian@misterf.us "
cd repos/MisterF/misterf-web
NODE_ENV=production node dist/server/landing/seedDemoActivitiesCli.js
"
```

Three things about that command:

- **`NODE_ENV=production` is not optional.** It is what makes `config/env.ts`
  load the server's `.env.production`, and therefore the production
  `DATABASE_PATH`. Without it the seed happily targets the wrong database file
  and reports success.
- **It runs from `dist/`, not through `tsx`.** `deploy.sh` installs with
  `npm ci --omit=dev`, so dev dependencies — `tsx` included — are absent in
  production. The seeder lives under `src/` for exactly this reason (same
  precedent as `db/migrateCli.ts`), so `npm run build:server` compiles it.
  `npm run seed:landing-demos` is the local-only equivalent.
- **It is idempotent.** Resource ids derive from the fixture slug, so re-running
  updates the activities in place and share links stay stable — URLs already
  handed out keep working. Re-run it after any change to `demoActivities.ts`.

If it is never run, nothing breaks: the landing hides its example-activity
section rather than publishing a dead link. The failure is silent, which is
precisely why it belongs in this checklist.

The seeder creates an account (`LANDING_DEMO_EMAIL`, default
`examples@misterf.us`) with no password hash and no identity row, so it owns the
demo content and cannot be signed into. Its share links are created with
`collect_results` off: a stranger trying the demo is not recorded as a
participant.

## Secrets And Environment

- Production secrets live in the server's `.env.production`, which is gitignored
  and NOT synced by `git pull`. Set or rotate them by editing the remote
  `.env.production` directly, then restart the app so it re-reads the file.
- Append idempotently (guard with `grep -q '^VAR=' .env.production` before
  appending) so re-runs do not duplicate lines.
- Never print secret values back and never commit them. Verify only by
  name / length / prefix.

## Restarting And Reading State

- Restart production:
  `pm2 restart ecosystem.config.cjs --only misterf-web --env production --update-env`.
- `pm2 describe misterf-web` — status, restarts, uptime, unstable restarts.
- `pm2 logs misterf-web --lines 30 --nostream` — recent logs; grep for
  `error`, `migrat`, `listening`.

## Cautions

- This is a LIVE server. Confirm before impactful or destructive actions; a bad
  restart can crash-loop the app.
- Restarting the app re-runs database migrations on startup. The production
  database is a separate, persistent SQLite file and is NOT reset by a deploy.
- See `database-migration-safety`: editing already-applied migrations in place
  (a "reset the DB" strategy) works only for fresh databases and will break an
  existing production database. Production needs forward-only migrations, or an
  explicit, user-confirmed data reset.
- Never delete or reset the production database without explicit user
  confirmation.
