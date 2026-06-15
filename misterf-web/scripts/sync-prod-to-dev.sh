#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REMOTE_HOST="${PROD_SSH_HOST:-arian@misterf.us}"
REMOTE_APP_DIR="${PROD_APP_DIR:-repos/MisterF/misterf-web}"
REMOTE_DB_PATH="${PROD_DB_PATH:-}"
LOCAL_DB_PATH="${DEV_DB_PATH:-$PROJECT_ROOT/data/misterf.sqlite}"
DOWNLOAD_DIR="$PROJECT_ROOT/tmp/prod-db-sync"
RUN_MIGRATIONS=1
REPLACE_LOCAL=0

usage() {
  cat <<'EOF'
Usage:
  npm run sync-prod-to-dev -- --replace-local [options]

Options:
  --replace-local              Required. Replace the local development database.
  --skip-migrations            Download and replace the local database without running local migrations.
  --remote-host <host>         SSH host. Defaults to PROD_SSH_HOST or arian@misterf.us.
  --remote-app-dir <path>      Remote app directory. Defaults to PROD_APP_DIR or repos/MisterF/misterf-web.
  --remote-db-path <path>      Remote SQLite path. Defaults to PROD_DB_PATH or remote production env detection.
  --local-db-path <path>       Local SQLite path. Defaults to DEV_DB_PATH or ./data/misterf.sqlite.
  -h, --help                   Show this help.

Environment:
  PROD_SSH_HOST                SSH target, for example arian@misterf.us.
  PROD_APP_DIR                 Remote app directory.
  PROD_DB_PATH                 Remote SQLite path.
  DEV_DB_PATH                  Local SQLite path to replace.

This script creates a consistent SQLite backup on the production host, downloads
it, backs up the existing local database, replaces the local database, and runs
local migrations unless --skip-migrations is set.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --replace-local)
      REPLACE_LOCAL=1
      shift
      ;;
    --skip-migrations)
      RUN_MIGRATIONS=0
      shift
      ;;
    --remote-host)
      REMOTE_HOST="${2:-}"
      shift 2
      ;;
    --remote-app-dir)
      REMOTE_APP_DIR="${2:-}"
      shift 2
      ;;
    --remote-db-path)
      REMOTE_DB_PATH="${2:-}"
      shift 2
      ;;
    --local-db-path)
      LOCAL_DB_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$REPLACE_LOCAL" != "1" ]]; then
  echo "Refusing to replace the local database without --replace-local." >&2
  usage >&2
  exit 1
fi

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_APP_DIR" || -z "$LOCAL_DB_PATH" ]]; then
  echo "Remote host, remote app directory, and local database path are required." >&2
  exit 1
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command ssh
require_command scp
require_command sqlite3

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL_DB_PATH="$(cd "$(dirname "$LOCAL_DB_PATH")" && pwd)/$(basename "$LOCAL_DB_PATH")"
DOWNLOADED_DB_PATH="$DOWNLOAD_DIR/prod-$TIMESTAMP.sqlite"
LOCAL_BACKUP_PATH="$DOWNLOAD_DIR/local-before-prod-sync-$TIMESTAMP.sqlite"
REMOTE_BACKUP_PATH="/tmp/misterf-prod-sync-$TIMESTAMP.sqlite"

mkdir -p "$DOWNLOAD_DIR"
mkdir -p "$(dirname "$LOCAL_DB_PATH")"

echo "==> Remote host: $REMOTE_HOST"
echo "==> Remote app dir: $REMOTE_APP_DIR"

if [[ -z "$REMOTE_DB_PATH" ]]; then
  echo "==> Detecting remote production database path"
  REMOTE_DB_PATH="$(
    ssh "$REMOTE_HOST" "set -euo pipefail; cd '$REMOTE_APP_DIR'; NODE_ENV=production node --input-type=module -e \"import('./dist/server/config/env.js').then(({ env }) => console.log(env.databasePath))\""
  )"
fi

if [[ -z "$REMOTE_DB_PATH" ]]; then
  echo "Could not resolve the remote database path." >&2
  exit 1
fi

echo "==> Remote database: $REMOTE_DB_PATH"
echo "==> Creating remote SQLite backup"
ssh "$REMOTE_HOST" "set -euo pipefail; sqlite3 '$REMOTE_DB_PATH' \".backup '$REMOTE_BACKUP_PATH'\"; sqlite3 '$REMOTE_BACKUP_PATH' 'PRAGMA integrity_check;'"

echo "==> Downloading backup to $DOWNLOADED_DB_PATH"
scp "$REMOTE_HOST:$REMOTE_BACKUP_PATH" "$DOWNLOADED_DB_PATH"

echo "==> Removing remote temporary backup"
ssh "$REMOTE_HOST" "rm -f '$REMOTE_BACKUP_PATH'"

echo "==> Validating downloaded database"
INTEGRITY_RESULT="$(sqlite3 "$DOWNLOADED_DB_PATH" 'PRAGMA integrity_check;')"
if [[ "$INTEGRITY_RESULT" != "ok" ]]; then
  echo "Downloaded database failed integrity check: $INTEGRITY_RESULT" >&2
  exit 1
fi

if [[ -f "$LOCAL_DB_PATH" ]]; then
  echo "==> Backing up current local database to $LOCAL_BACKUP_PATH"
  cp "$LOCAL_DB_PATH" "$LOCAL_BACKUP_PATH"
fi

echo "==> Replacing local database at $LOCAL_DB_PATH"
cp "$DOWNLOADED_DB_PATH" "$LOCAL_DB_PATH"

if [[ "$RUN_MIGRATIONS" == "1" ]]; then
  echo "==> Building server before running migrations"
  (cd "$PROJECT_ROOT" && npm run build:server)

  echo "==> Running local migrations against synced database"
  (cd "$PROJECT_ROOT" && ENV_FILE=/dev/null DATABASE_PATH="$LOCAL_DB_PATH" node dist/server/db/migrateCli.js)
fi

echo "==> Final local integrity check"
sqlite3 "$LOCAL_DB_PATH" 'PRAGMA integrity_check;'

echo "==> Applied migrations"
sqlite3 "$LOCAL_DB_PATH" 'SELECT id, name, applied_at FROM schema_migrations ORDER BY id;'

echo "==> Sync complete"
echo "Downloaded copy: $DOWNLOADED_DB_PATH"
if [[ -f "$LOCAL_BACKUP_PATH" ]]; then
  echo "Previous local backup: $LOCAL_BACKUP_PATH"
fi
echo "Local database: $LOCAL_DB_PATH"
