#!/usr/bin/env bash
# VPS Production Deploy Script (AlmaLinux)
# Non-interactive but requires confirmation before critical steps.

set -euo pipefail
IFS=$'\n\t'

REPO_PATH=${1:-/srv/ai-tutor}
REF=${2:-origin/master}
ENV_PATH=${3:-$REPO_PATH/.env.production}

echo "=== AI-Tutor VPS Production Deploy ==="
echo "Repo: $REPO_PATH"
echo "Ref:  $REF"
echo "Env:  $ENV_PATH"

if [ ! -d "$REPO_PATH" ]; then
  echo "Repo path $REPO_PATH does not exist. Clone the repo and re-run."; exit 1
fi

cd "$REPO_PATH"

if [ ! -f "$ENV_PATH" ]; then
  echo ".env.production not found at $ENV_PATH. Aborting."; exit 2
fi

echo "Loading environment from $ENV_PATH"
set -a; . "$ENV_PATH" || true; set +a

echo "Fetching origin and checking out $REF"
git fetch origin --tags
git checkout -B deploy/prod "$REF"

echo "Stopping any previous PM2 processes (safe)"
pm2 stop all || true

echo "Installing dependencies (npm ci)"
npm ci

echo "Building app (npm run build)"
npm run build

echo "Starting PM2 processes from ecosystem.config.js"
pm2 start ecosystem.config.js

echo "Saving PM2 process list"
pm2 save

echo "Generating startup script (pm2 startup). You must run the printed sudo command to enable on boot."
pm2 startup systemd

echo "Production deploy finished. Run 'pm2 status' and inspect logs."
echo "To enable PM2 on boot, run the sudo command printed above (it contains PATH and user info)."

exit 0
