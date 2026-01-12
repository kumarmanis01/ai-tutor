#!/usr/bin/env bash
set -euo pipefail

# Parent deployment script
# Usage: deploy-and-run.sh [--auto] [--branch BRANCH]
# - --auto : pass --auto to vps-verification.sh (non-interactive)
# - --branch BRANCH : pull the named branch (defaults to current branch)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}"

AUTO_FLAG=0
BRANCH=""
CLEAN_FLAG=1
KILL_FLAG=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto) AUTO_FLAG=1; shift ;;
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
  "${SCRIPT_DIR}/run-web.sh"
  "${SCRIPT_DIR}/run-worker.sh"
)

for s in "${CHILD_SCRIPTS[@]}"; do
  if [ -f "$s" ]; then
    chmod +x "$s" || true
    echo "[deploy] ensured executable: $s"
  else
    echo "[deploy] skipped (not found): $s"
  fi
done

# optional pm2 cleaning steps
if [ "${CLEAN_FLAG}" -eq 1 ]; then
  echo "[deploy] cleaning pm2 processes: stop all, delete all, flush"
  pm2 stop all || true
  pm2 delete all || true
  pm2 flush || true
  if [ "${KILL_FLAG}" -eq 1 ]; then
    echo "[deploy] killing pm2 daemon (you may need to restart it)"
    pm2 kill || true
  fi
fi

# Run vps-verification (optional auto)
if [ -f "${SCRIPT_DIR}/vps-verification.sh" ]; then
  echo "[deploy] running vps-verification"
  if [ "${AUTO_FLAG}" -eq 1 ]; then
    "${SCRIPT_DIR}/vps-verification.sh" --auto
  else
    "${SCRIPT_DIR}/vps-verification.sh"
  fi
else
  echo "[deploy] warning: vps-verification.sh not found, skipping"
fi

# Run verify-dist if available
if [ -f "${SCRIPT_DIR}/verify-dist.sh" ]; then
  echo "[deploy] running verify-dist.sh"
  "${SCRIPT_DIR}/verify-dist.sh"
else
  echo "[deploy] verify-dist.sh not found, skipping"
fi

# Start/reload PM2 with the ecosystem config
if [ -f "${REPO_ROOT}/ecosystem.config.cjs" ]; then
  echo "[deploy] starting/reloading PM2 ecosystem.config.cjs (env=production)"
  pm2 start ecosystem.config.cjs --env production --update-env || pm2 reload ecosystem.config.cjs --env production --update-env || true
elif [ -f "${REPO_ROOT}/ecosystem.config.js" ]; then
  echo "[deploy] starting/reloading PM2 ecosystem.config.js (env=production)"
  pm2 start ecosystem.config.js --env production --update-env || pm2 reload ecosystem.config.js --env production --update-env || true
else
  echo "[deploy] no ecosystem.config.* found, skipping PM2 ecosystem start"
fi

sleep 1

# Ensure web and worker are running under PM2 and obey the ecosystem env
# Start them via their wrapper scripts if PM2 does not already have them

ensure_pm2_process() {
  local name="$1"
  local script="$2"
  if pm2 id "${name}" >/dev/null 2>&1; then
    echo "[deploy] pm2 process ${name} already exists"
    pm2 restart "${name}" --update-env || true
  else
    if [ -f "${script}" ]; then
      echo "[deploy] starting ${name} via ${script}"
      pm2 start "${script}" --name "${name}" --interpreter /bin/bash --update-env
    else
      echo "[deploy] script ${script} missing; cannot start ${name}"
    fi
  fi
}

# names used in this repo (adjust if your ecosystem uses different names)
ensure_pm2_process "ai-tutor-web" "${SCRIPT_DIR}/run-web.sh"
ensure_pm2_process "content-engine-worker" "${SCRIPT_DIR}/run-worker.sh"

echo "[deploy] done. Use 'pm2 list' and 'pm2 logs <name>' to inspect processes."
