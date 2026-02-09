#!/usr/bin/env bash
set -euo pipefail

# PM2 start script for production
# - ensures pm2 is installed
# - starts apps from ecosystem.config.cjs with production env
# - saves the pm2 process list and generates a systemd startup script

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

echo "[pm2-start] Using repo: $REPO_ROOT"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[pm2-start] pm2 not found — installing globally (requires sudo)"
  sudo npm install -g pm2@latest
fi

echo "[pm2-start] Starting apps with ecosystem.config.cjs"
pm2 start ecosystem.config.cjs --env production --update-env

echo "[pm2-start] Saving process list"
pm2 save

echo "[pm2-start] Ensure pm2-logrotate is installed and configured"
pm2 install pm2-logrotate || true
pm2 set pm2-logrotate:max_size 10M || true
pm2 set pm2-logrotate:retain 14 || true

echo "[pm2-start] Generating systemd startup script (may require sudo)"
sudo pm2 startup systemd -u $(whoami) --hp "$HOME" || true

echo "[pm2-start] Done. Check 'pm2 status' and 'pm2 logs <name>'"
