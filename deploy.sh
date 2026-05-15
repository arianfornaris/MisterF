#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/misterf-web"
REMOTE_HOST="arian@misterf.us"
REMOTE_DIR="repos/MisterF/misterf-web"
PM2_APP_NAME="misterf-web"

echo "==> Building local app"
cd "$APP_DIR"
npm run build

echo "==> Pushing git changes"
git push

echo "==> Deploying to $REMOTE_HOST"
ssh "$REMOTE_HOST" "
set -euo pipefail
cd '$REMOTE_DIR'
git pull
pm2 restart ecosystem.config.cjs --only '$PM2_APP_NAME' --env production --update-env
"

echo "==> Deploy complete"
