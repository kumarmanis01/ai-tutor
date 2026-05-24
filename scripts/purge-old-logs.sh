#!/usr/bin/env bash
set -euo pipefail

# Purge log files older than RETAIN_DAYS from:
#   logs/pm2/        -- PM2 console output (stdout + stderr) for all processes
#   logs/archive/    -- deploy-time archived log bundles (from reset-logs.sh)
#   logs/            -- deploy build logs (deploy-build-*.log)
#
# Registered as a daily cron job by deploy-and-run.sh (runs at 03:00 local time).
# Safe to run manually at any time; it is idempotent.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${REPO_ROOT}/logs"
RETAIN_DAYS=5

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

echo "[$(ts)] purge-old-logs: purging files older than ${RETAIN_DAYS} days"

# PM2 console logs (current files + pm2-logrotate rotated copies)
if [ -d "${LOG_DIR}/pm2" ]; then
  find "${LOG_DIR}/pm2" -maxdepth 1 -type f \
    \( -name "*.log" -o -name "*.log.*" \) \
    -mtime "+${RETAIN_DAYS}" -print -delete 2>/dev/null || true
fi

# Deploy build logs
find "${LOG_DIR}" -maxdepth 1 -type f \
  -name "deploy-build-*.log" \
  -mtime "+${RETAIN_DAYS}" -print -delete 2>/dev/null || true

# Archived log bundles created by reset-logs.sh at each deploy
if [ -d "${LOG_DIR}/archive" ]; then
  find "${LOG_DIR}/archive" -maxdepth 1 -mindepth 1 -type d \
    -mtime "+${RETAIN_DAYS}" -print -exec rm -rf {} + 2>/dev/null || true
fi

echo "[$(ts)] purge-old-logs: done"
