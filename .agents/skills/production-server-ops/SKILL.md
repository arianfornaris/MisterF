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

The server checks out the branch that `git pull` advances (currently `main`).
So the release must be on `main` before deploying — deploying from a feature
branch (e.g. `v3`) is a no-op (`Already up to date`). See `versioning-and-releases`
→ "Deploy Branch — Merge To main First", which requires user confirmation before
merging a working branch into `main`.

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
