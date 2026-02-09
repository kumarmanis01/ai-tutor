#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Production deploy script for AlmaLinux + PM2
#
# Usage:
#   ./scripts/deploy-and-run.sh                  # deploy current branch
#   ./scripts/deploy-and-run.sh --branch main    # deploy specific branch
#   ./scripts/deploy-and-run.sh --kill            # kill PM2 daemon first
#
# Flow:
#   1. Git pull (fast-forward only)
#   2. Export .env.production
#   3. Install dependencies (full — devDeps needed for build)
#   4. Prisma generate + migrate
#   5. Clean old build artifacts
#   6. Build workers + Next.js
#   7. Verify dist is production-clean
#   8. Ensure logs, perms, script executability
#   9. PM2 stop → delete → start all 3 processes
#  10. PM2 save + startup (systemd persistence)
#  11. Health check
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BRANCH=""
KILL_FLAG=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kill)          KILL_FLAG=1; shift ;;
    --branch)        BRANCH="$2"; shift 2 ;;
    --branch=*)      BRANCH="${1#*=}"; shift ;;
    -h|--help)
      echo "Usage: $0 [--branch BRANCH] [--kill]"
      echo "  --branch BRANCH   checkout and pull this branch (default: current)"
      echo "  --kill             kill PM2 daemon before restarting"
      exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

cd "${REPO_ROOT}"

step() { echo; echo "=====> $1"; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. GIT PULL
# ─────────────────────────────────────────────────────────────────────────────
step "1/11 — Git fetch and pull"
git fetch origin --prune

if [ -z "${BRANCH}" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
echo "On branch ${BRANCH} at $(git rev-parse --short HEAD)"

# ─────────────────────────────────────────────────────────────────────────────
# 2. EXPORT .env.production
# ─────────────────────────────────────────────────────────────────────────────
step "2/11 — Export .env.production"
if [ ! -f "${REPO_ROOT}/.env.production" ]; then
  echo "FATAL: .env.production not found at ${REPO_ROOT}/.env.production" >&2
  exit 1
fi

# Normalize line endings
if command -v dos2unix >/dev/null 2>&1; then
  dos2unix "${REPO_ROOT}/.env.production" 2>/dev/null || true
else
  sed -i 's/\r$//' "${REPO_ROOT}/.env.production" || true
fi

set -o allexport; source "${REPO_ROOT}/.env.production"; set +o allexport

echo "DATABASE_URL set: $([ -n "${DATABASE_URL:-}" ] && echo 'YES' || echo 'NO')"
echo "REDIS_URL set:    $([ -n "${REDIS_URL:-}" ] && echo 'YES' || echo 'NO')"

# ─────────────────────────────────────────────────────────────────────────────
# 3. INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────
step "3/11 — Install dependencies"
# Full install (devDeps needed for tsc, next build, tsc-alias, etc.)
npm ci

# ─────────────────────────────────────────────────────────────────────────────
# 4. PRISMA GENERATE + MIGRATE
# ─────────────────────────────────────────────────────────────────────────────
step "4/11 — Prisma generate + migrate"
npx prisma generate

if [ -f "${SCRIPT_DIR}/run-migrate.sh" ]; then
  bash "${SCRIPT_DIR}/run-migrate.sh"
else
  npx prisma migrate deploy --schema=prisma/schema.prisma
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. CLEAN OLD BUILD ARTIFACTS
# ─────────────────────────────────────────────────────────────────────────────
step "5/11 — Clean old build artifacts"
rm -rf "${REPO_ROOT}/.next" || true
rm -rf "${REPO_ROOT}/dist" || true
echo "Removed .next/ and dist/"

# ─────────────────────────────────────────────────────────────────────────────
# 6. BUILD
# ─────────────────────────────────────────────────────────────────────────────
step "6/11 — Build workers"
npm run build:workers

step "6/11 — Build Next.js"
LOG_DIR="${REPO_ROOT}/logs"
mkdir -p "${LOG_DIR}"
BUILD_LOG="${LOG_DIR}/deploy-build-$(date -u +%Y%m%dT%H%M%SZ).log"

if npm run build:prod >>"${BUILD_LOG}" 2>&1; then
  echo "Next.js build succeeded (log: ${BUILD_LOG})"
elif npm run build >>"${BUILD_LOG}" 2>&1; then
  echo "Next.js build succeeded via fallback (log: ${BUILD_LOG})"
else
  echo "FATAL: Next.js build failed. Last 100 lines:" >&2
  tail -n 100 "${BUILD_LOG}" >&2 || true
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. VERIFY DIST
# ─────────────────────────────────────────────────────────────────────────────
step "7/11 — Verify dist is production-clean"
if [ -f "${SCRIPT_DIR}/verify-dist.sh" ]; then
  bash "${SCRIPT_DIR}/verify-dist.sh"
else
  echo "verify-dist.sh not found, skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. ENSURE LOGS, PERMS, EXECUTABILITY
# ─────────────────────────────────────────────────────────────────────────────
step "8/11 — Ensure logs, permissions, script executability"

# Logs directory
mkdir -p "${REPO_ROOT}/logs"

# .env.production permissions
if [ -f "${SCRIPT_DIR}/ensure-env-perms.sh" ]; then
  bash "${SCRIPT_DIR}/ensure-env-perms.sh"
else
  chmod 600 "${REPO_ROOT}/.env.production" || true
fi

# Make all wrapper scripts executable
for script in run-worker.sh run-scheduler.sh run-migrate.sh; do
  if [ -f "${SCRIPT_DIR}/${script}" ]; then
    chmod +x "${SCRIPT_DIR}/${script}"
    echo "chmod +x ${script}"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 9. PM2 STOP → DELETE → START
# ─────────────────────────────────────────────────────────────────────────────
step "9/11 — PM2 restart"

# Archive old logs before restarting
if [ -f "${SCRIPT_DIR}/reset-logs.sh" ]; then
  bash "${SCRIPT_DIR}/reset-logs.sh" || true
fi

# Stop and delete existing processes
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 flush 2>/dev/null || true

if [ "${KILL_FLAG}" -eq 1 ]; then
  echo "Killing PM2 daemon (--kill flag)"
  pm2 kill || true
fi

# Start all 3 processes (web, worker, scheduler)
if [ ! -f "${REPO_ROOT}/ecosystem.config.cjs" ]; then
  echo "FATAL: ecosystem.config.cjs not found" >&2
  exit 1
fi

pm2 start ecosystem.config.cjs --env production --update-env

# ─────────────────────────────────────────────────────────────────────────────
# 10. PM2 SAVE + STARTUP (systemd persistence)
# ─────────────────────────────────────────────────────────────────────────────
step "10/11 — PM2 save + startup"
pm2 save

# Log rotation
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 10M 2>/dev/null || true
pm2 set pm2-logrotate:retain 14 2>/dev/null || true

# Systemd startup (survives reboot)
sudo pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
# 11. HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────
step "11/11 — Health check"
echo "Waiting 5s for processes to stabilize..."
sleep 5

EXPECTED_PROCS=("ai-tutor-web" "content-engine-worker" "ai-tutor-scheduler")
FAILED=0

for proc in "${EXPECTED_PROCS[@]}"; do
  status=$(pm2 show "${proc}" 2>/dev/null | grep -i "status" | head -1 | awk '{print $NF}' || echo "not found")
  if [ "${status}" = "online" ]; then
    echo "  ${proc}: online"
  else
    echo "  ${proc}: ${status} <-- CHECK LOGS: pm2 logs ${proc} --lines 50"
    FAILED=$((FAILED + 1))
  fi
done

echo
pm2 status

if [ ${FAILED} -gt 0 ]; then
  echo
  echo "WARNING: ${FAILED} process(es) not online. Check logs above."
else
  echo
  echo "All ${#EXPECTED_PROCS[@]} processes online. Deploy complete."
fi

echo
echo "Useful commands:"
echo "  pm2 logs ai-tutor-web --lines 50"
echo "  pm2 logs content-engine-worker --lines 50"
echo "  pm2 logs ai-tutor-scheduler --lines 50"
echo "  pm2 monit"
