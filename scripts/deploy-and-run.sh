#!/usr/bin/env bash
set -euo pipefail

# Parent deployment script
# Usage: deploy-and-run.sh [--auto] [--branch BRANCH]
# - --auto : pass --auto to vps-verification.sh (non-interactive)
# - --branch BRANCH : pull the named branch (defaults to current branch)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}"

AUTO_FLAG=1
BRANCH=""
CLEAN_FLAG=1
KILL_FLAG=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto) AUTO_FLAG=1; shift ;;
    --no-auto) AUTO_FLAG=0; shift ;;
    --no-clean) CLEAN_FLAG=0; shift ;;
    --kill) KILL_FLAG=1; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --branch=*) BRANCH="${1#*=}"; shift ;;
    -h|--help) echo "Usage: $0 [--auto] [--branch BRANCH] [--no-clean] [--kill]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

cd "${REPO_ROOT}"

echo "[deploy] fetching origin..."
git fetch origin --prune

if [ -z "${BRANCH}" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

echo "[deploy] pulling branch ${BRANCH} (fast-forward only)..."
git checkout "${BRANCH}"
git pull --ff origin "${BRANCH}"

echo "[deploy] making child scripts executable (if present)"
CHILD_SCRIPTS=(
  "${SCRIPT_DIR}/ensure-logs.sh"
  "${SCRIPT_DIR}/reset-logs.sh"
  "${SCRIPT_DIR}/vps-verification.sh"
  "${SCRIPT_DIR}/verify-dist.sh"

)

for s in "${CHILD_SCRIPTS[@]}"; do
  if [ -f "$s" ]; then
    chmod +x "$s" || true
    echo "[deploy] ensured executable: $s"
  else
    echo "[deploy] skipped (not found): $s"
  fi
done

# verify env permissions and non-tracking
if [ -f "${REPO_ROOT}/scripts/ensure-env-perms.sh" ]; then
  echo "[deploy] checking .env.production permissions"
  bash "${REPO_ROOT}/scripts/ensure-env-perms.sh"
else
  echo "[deploy] ensure-env-perms.sh missing; ensure .env.production exists and is chmod 600"
fi

# Run log helpers first (ensure then reset)
if [ -f "${SCRIPT_DIR}/ensure-logs.sh" ]; then
  echo "[deploy] running ensure-logs.sh"
  bash "${SCRIPT_DIR}/ensure-logs.sh" || true
else
  echo "[deploy] ensure-logs.sh not found; skipping"
fi

if [ -f "${SCRIPT_DIR}/reset-logs.sh" ]; then
  echo "[deploy] running reset-logs.sh"
  bash "${SCRIPT_DIR}/reset-logs.sh" || true
else
  echo "[deploy] reset-logs.sh not found; skipping"
fi

# Run vps-verification once, non-interactive (default yes)
if [ -f "${SCRIPT_DIR}/vps-verification.sh" ]; then
  echo "[deploy] running vps-verification.sh (--yes)"
  "${SCRIPT_DIR}/vps-verification.sh" --yes || true
else
  echo "[deploy] warning: vps-verification.sh not found, skipping"
fi

# Reset PM2 (stop/delete/flush) so ecosystem starts cleanly
echo "[deploy] resetting pm2 processes: stop all, delete all, flush"
pm2 stop all || true
pm2 delete all || true
pm2 flush || true
if [ "${KILL_FLAG}" -eq 1 ]; then
  echo "[deploy] killing pm2 daemon (you may need to restart it)"
  pm2 kill || true
fi

# NOTE: PM2 start and verify will run after we export .env.production below.
# This keeps start/stop logic atomic and avoids duplicate starts.

# Export env before starting PM2 so processes inherit .env.production
if [ -f "${REPO_ROOT}/.env.production" ]; then
  echo "[deploy] exporting .env.production into environment"
  set -o allexport; source "${REPO_ROOT}/.env.production"; set +o allexport
else
  echo "[deploy] .env.production not found; ensure envs are set in PM2"
fi

# Start/reload PM2 with the ecosystem config (prefer start)
if [ -f "${REPO_ROOT}/ecosystem.config.cjs" ]; then
  echo "[deploy] starting PM2 ecosystem.config.cjs (env=production)"
  pm2 start ecosystem.config.cjs --env production --update-env || pm2.reload ecosystem.config.cjs --env production --update-env || true
elif [ -f "${REPO_ROOT}/ecosystem.config.js" ]; then
  echo "[deploy] starting PM2 ecosystem.config.js (env=production)"
  pm2 start ecosystem.config.js --env production --update-env || pm2.reload ecosystem.config.js --env production --update-env || true
else
  echo "[deploy] no ecosystem.config.* found, skipping PM2 ecosystem start"
fi

sleep 1

# Ecosystem-managed PM2 processes are the canonical source of truth.
# The previous wrapper fallback that started `run-web.sh` / `run-worker.sh`
# caused duplicate starts and env drift. We intentionally removed it so the
# deploy flow only relies on the ecosystem file and `--update-env`.

echo "[deploy] done. Use 'pm2 list' and 'pm2 logs <name>' to inspect processes."
