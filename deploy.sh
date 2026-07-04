#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/misterf-web"
REMOTE_HOST="arian@misterf.us"
REMOTE_DIR="repos/MisterF/misterf-web"
PM2_APP_NAME="misterf-web"

cd "$APP_DIR"

echo "==> Building local app"
npm run build

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: there are uncommitted local changes. Commit or discard them before deploying."
  exit 1
fi

APP_VERSION="$(node -p "require('./package.json').version")"
EXPECTED_TAG="v$APP_VERSION"
if ! git tag --points-at HEAD | grep -qx "$EXPECTED_TAG"; then
  echo "Error: HEAD is not tagged $EXPECTED_TAG. Bump package.json per the"
  echo "versioning-and-releases skill and tag the release before deploying:"
  echo "  git tag -a $EXPECTED_TAG -m '<release summary>'"
  exit 1
fi

echo "==> Deploying version $APP_VERSION ($EXPECTED_TAG)"
echo "==> Pushing git changes"
git push --follow-tags

echo "==> Deploying to $REMOTE_HOST"
ssh "$REMOTE_HOST" "
set -euo pipefail
cd '$REMOTE_DIR'
git pull
pm2 restart ecosystem.config.cjs --only '$PM2_APP_NAME' --env production --update-env
"

echo "==> Deploy complete"
