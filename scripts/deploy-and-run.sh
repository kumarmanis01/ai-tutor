#!/usr/bin/env bash
set -euo pipefail

# Parent deployment script
# Usage: deploy-and-run.sh [--auto] [--branch BRANCH]
# - --auto : pass --auto to vps-verification.sh (non-interactive)
# - --branch BRANCH : pull the named branch (defaults to current branch)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

AUTO_FLAG=1
BRANCH=""
CLEAN_FLAG=0
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
git pull --ff-only origin "${BRANCH}"

# ─────────────────────────────────────────────────────────────────────────────
# EARLY ENVIRONMENT EXPORT
# Export .env.production immediately after git pull so all subsequent steps
# (vps-verification, PM2, etc.) have access to DATABASE_URL, REDIS_URL, etc.
# ─────────────────────────────────────────────────────────────────────────────
if [ -f "${REPO_ROOT}/.env.production" ]; then
  echo "[deploy] exporting .env.production into environment (early)"
  # Sanitize .env.production in-place to avoid shell-splitting on unescaped '&' or CRLF issues.
  sanitize_env_file() {
    local f="$1"
    if [ ! -f "$f" ]; then
      return 0
    fi
    echo "[deploy] sanitizing $f"
    # Normalize line endings (prefer dos2unix when available)
    if command -v dos2unix >/dev/null 2>&1; then
      dos2unix "$f" || true
    else
      # remove CR char at line ends
      sed -i 's/\r$//' "$f" || true
    fi

    # Ensure DATABASE_URL is single-quoted if not already quoted
    perl -0777 -pe "s/^(DATABASE_URL=)(?!['\"])(.*)$/\$1'\$2'/m" -i "$f" || true
    # Ensure REDIS_URL is single-quoted if not already quoted
    perl -0777 -pe "s/^(REDIS_URL=)(?!['\"])(.*)$/\$1'\$2'/m" -i "$f" || true

    # Print short debugging preview
    grep -E "^DATABASE_URL=|^REDIS_URL=" "$f" || true
  }

  sanitize_env_file "${REPO_ROOT}/.env.production"

  # Export into environment for rest of the script so child processes inherit
  set -o allexport; source "${REPO_ROOT}/.env.production"; set +o allexport
  echo "[deploy] DATABASE_URL is set: $([ -n \"${DATABASE_URL:-}\" ] && echo 'YES' || echo 'NO')"
  echo "[deploy] REDIS_URL is set: $([ -n \"${REDIS_URL:-}\" ] && echo 'YES' || echo 'NO')"
else
  echo "[deploy] WARNING: .env.production not found at ${REPO_ROOT}/.env.production"
fi

# ─────────────────────────────────────────────────────────────────────────────
# INSTALL DEPENDENCIES & BUILD
# ─────────────────────────────────────────────────────────────────────────────
echo "[deploy] installing production dependencies..."
cd "${REPO_ROOT}"
NODE_ENV=production npm ci --omit=dev || npm install --omit=dev

echo "[deploy] generating Prisma client..."
npx prisma generate

echo "[deploy] deploying Prisma migrations (will abort on failure)..."
# Re-export to be safe
set -o allexport; source "${REPO_ROOT}/.env.production"; set +o allexport

# If a helper migration script exists, prefer it (it waits on the DB host/port).
if [ -f "${REPO_ROOT}/scripts/run-migrate.sh" ]; then
  echo "[deploy] running scripts/run-migrate.sh"
  bash "${REPO_ROOT}/scripts/run-migrate.sh" || { echo "[deploy] ERROR: scripts/run-migrate.sh failed" >&2; exit 1; }
else
  # Fallback: try to wait for the DB host/port derived from DATABASE_URL before running migrate
  wait_for_port() {
    local host="$1"; local port="$2"; local timeout_seconds=${3:-60}
    echo "[deploy] waiting for ${host}:${port} (timeout ${timeout_seconds}s)"
    for i in $(seq 1 ${timeout_seconds}); do
      if bash -c "</dev/tcp/${host}/${port}" >/dev/null 2>&1; then
        echo "[deploy] ${host}:${port} reachable"
        return 0
      fi
      sleep 1
    done
    return 1
  }

  if [ -n "${DATABASE_URL:-}" ]; then
    # Use Python to robustly parse the URL (hostname and port may be absent)
    db_host=$(python - <<'PY'
from urllib.parse import urlparse
import os
u = urlparse(os.environ.get('DATABASE_URL',''))
print(u.hostname or '')
PY
)
    db_port=$(python - <<'PY'
from urllib.parse import urlparse
import os
u = urlparse(os.environ.get('DATABASE_URL',''))
print(u.port or '')
PY
)
    if [ -n "$db_host" ] && [ -n "$db_port" ]; then
      if ! wait_for_port "$db_host" "$db_port" 60; then
        echo "[deploy] ERROR: timed out waiting for DB ${db_host}:${db_port}" >&2
        exit 1
      fi
    else
      echo "[deploy] WARN: couldn't parse host/port from DATABASE_URL; continuing to prisma migrate deploy"
    fi
  else
    echo "[deploy] WARNING: DATABASE_URL not set; prisma migrate may fail"
  fi

  if npx prisma migrate deploy --schema=prisma/schema.prisma; then
    echo "[deploy] prisma migrate deploy: OK"
  else
    echo "[deploy] ERROR: prisma migrate deploy failed. Aborting deployment." >&2
    exit 1
  fi
fi

echo "[deploy] building workers..."
npm run build:workers

echo "[deploy] building Next.js app..."
npm run build || true

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

# Ensure worker wrapper is executable so PM2 can run it reliably
if [ -f "${REPO_ROOT}/scripts/run-worker.sh" ]; then
  chmod +x "${REPO_ROOT}/scripts/run-worker.sh" || true
  echo "[deploy] ensured executable: ${REPO_ROOT}/scripts/run-worker.sh"
else
  echo "[deploy] warning: scripts/run-worker.sh not found; PM2 will run whatever ecosystem config references"
fi

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

# ─────────────────────────────────────────────────────────────────────────────
# PM2 RESET & RESTART
# Always delete and restart PM2 processes to ensure clean state with env vars
# ─────────────────────────────────────────────────────────────────────────────
echo "[deploy] resetting pm2 processes for clean start"
pm2 delete all 2>/dev/null || true
pm2 flush 2>/dev/null || true

if [ "${KILL_FLAG}" -eq 1 ]; then
  echo "[deploy] killing pm2 daemon (you may need to restart it)"
  pm2 kill || true
fi

# Start PM2 with the ecosystem config
# Environment was already exported early in the script
if [ -f "${REPO_ROOT}/ecosystem.config.cjs" ]; then
  echo "[deploy] starting PM2 ecosystem.config.cjs (env=production)"
  pm2 start ecosystem.config.cjs --env production --update-env || true
  pm2 save || true
elif [ -f "${REPO_ROOT}/ecosystem.config.js" ]; then
  echo "[deploy] starting PM2 ecosystem.config.js (env=production)"
  pm2 start ecosystem.config.js --env production --update-env || true
  pm2 save || true
else
  # Ensure the worker process picks up the freshly exported environment (wrapper relies on .env.production)
  echo "[deploy] restarting worker to ensure wrapper-sourced env is active"
  pm2 restart content-engine-worker --update-env || true
  pm2 save || true
  echo "[deploy] no ecosystem.config.* found, skipping PM2 ecosystem start"
fi

sleep 2
pm2 status

echo "[deploy] done. Use 'pm2 list' and 'pm2 logs <name>' to inspect processes."
