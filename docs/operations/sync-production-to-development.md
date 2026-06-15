# Sync Production Data To Development

Use this workflow when you want the local development database to mirror production data.

This is useful for:

- rehearsing migrations against production-shaped data,
- reproducing production-only bugs locally,
- validating UI and reports with real data volume.

## What Must Be Synced

At the moment, production runtime state is stored in SQLite.

No production upload directory is currently required:

- The app does not use an upload middleware such as Multer.
- The server only serves static assets from `public/` and vendor assets from `node_modules`.
- Brand images under `public/brand` are repository assets.
- Client bundles under `public/build` are generated from source.
- Share QR codes are generated as in-memory `data:` URLs and are not stored on disk.

If future work adds uploads, generated images, audio, or attachments, update this document and `scripts/sync-prod-to-dev.sh` to sync those runtime directories together with the database.

## Environment Caveat

The database may contain encrypted OpenRouter user keys. To exercise flows that decrypt those keys locally, the local environment must use the same `OPENROUTER_KEY_ENCRYPTION_SECRET` or fallback `APP_SESSION_SECRET` that was used in production.

Do not casually copy the full production `.env` into development. Prefer copying only the specific secret needed for a migration or debugging rehearsal, and remove it afterward if it is not needed.

## Safety Rules

- Never run experimental migrations directly against the production database.
- The sync script replaces the local development database only when `--replace-local` is provided.
- The script creates a timestamped backup of the current local database before replacing it.
- Treat the synced database as sensitive production data. It may contain users, sessions, purchase records, learner content, and encrypted provider keys.
- Do not commit synced databases or local backups.

## Requirements

Local machine:

- `ssh`
- `scp`
- `sqlite3`
- project dependencies installed with `npm install`

Production host:

- SSH access
- `sqlite3`
- a working production build under the remote app directory

## Default Command

From `misterf-web/`:

```bash
npm run sync-prod-to-dev -- --replace-local
```

By default, the script uses:

- SSH host: `arian@misterf.us`
- remote app directory: `repos/MisterF/misterf-web`
- local database: `./data/misterf.sqlite`

The script detects the production database path by loading the remote production config:

```bash
NODE_ENV=production node --input-type=module -e "import('./dist/server/config/env.js').then(({ env }) => console.log(env.databasePath))"
```

## Configuration

You can override defaults with flags:

```bash
npm run sync-prod-to-dev -- \
  --replace-local \
  --remote-host arian@misterf.us \
  --remote-app-dir repos/MisterF/misterf-web \
  --remote-db-path /absolute/path/to/misterf.sqlite \
  --local-db-path ./data/misterf.sqlite
```

Or with environment variables:

```bash
PROD_SSH_HOST=arian@misterf.us \
PROD_APP_DIR=repos/MisterF/misterf-web \
PROD_DB_PATH=/absolute/path/to/misterf.sqlite \
DEV_DB_PATH=./data/misterf.sqlite \
npm run sync-prod-to-dev -- --replace-local
```

## What The Script Does

1. Resolves the production SQLite database path.
2. Creates a consistent remote SQLite backup with `.backup`.
3. Runs `PRAGMA integrity_check` on the remote backup.
4. Downloads the backup into `tmp/prod-db-sync/`.
5. Runs `PRAGMA integrity_check` locally.
6. Backs up the current local database into `tmp/prod-db-sync/`.
7. Replaces the local database.
8. Builds the server.
9. Runs local migrations against the synced database.
10. Prints final integrity and `schema_migrations` output.

## Migration Rehearsal

The normal command runs migrations after replacing the local database:

```bash
npm run sync-prod-to-dev -- --replace-local
```

To download and replace the database without running migrations:

```bash
npm run sync-prod-to-dev -- --replace-local --skip-migrations
```

Use `--skip-migrations` only when you want to inspect the exact production schema locally before applying local code migrations.

## After Syncing

Recommended checks:

```bash
sqlite3 data/misterf.sqlite 'PRAGMA integrity_check;'
sqlite3 data/misterf.sqlite 'SELECT id, name, applied_at FROM schema_migrations ORDER BY id;'
npm run typecheck
npm test
```

Then start the local app with the normal development environment.

## Restoring The Previous Local Database

The script prints the backup path for the previous local database, for example:

```text
Previous local backup: /path/to/misterf-web/tmp/prod-db-sync/local-before-prod-sync-20260615-120000.sqlite
```

To restore it manually:

```bash
cp tmp/prod-db-sync/local-before-prod-sync-YYYYMMDD-HHMMSS.sqlite data/misterf.sqlite
```
