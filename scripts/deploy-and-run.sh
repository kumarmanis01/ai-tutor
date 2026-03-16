#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Production deploy script for AlmaLinux + PM2
#
# Usage:
#   ./scripts/deploy-and-run.sh                  # deploy current branch
#   ./scripts/deploy-and-run.sh --branch main    # deploy specific branch
#   ./scripts/deploy-and-run.sh --kill            # kill PM2 daemon first
#   ./scripts/deploy-and-run.sh --seed            # also run seed scripts + Prisma Studio
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
#  11. Seed scripts (--seed): mark-admin, seed-ai-content, seed-ai-data
#  12. Prisma Studio (--seed): launched in background for data validation
#  13. Health check
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BRANCH=""
KILL_FLAG=0
SEED_FLAG=0
ADMIN_EMAIL="manish.mcaipu@gmail.com"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kill)          KILL_FLAG=1; shift ;;
    --seed)          SEED_FLAG=1; shift ;;
    --admin-email)   ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-email=*) ADMIN_EMAIL="${1#*=}"; shift ;;
    --branch)        BRANCH="$2"; shift 2 ;;
    --branch=*)      BRANCH="${1#*=}"; shift ;;
    -h|--help)
      echo "Usage: $0 [--branch BRANCH] [--kill] [--seed] [--admin-email EMAIL]"
      echo "  --branch BRANCH       checkout and pull this branch (default: current)"
      echo "  --kill                 kill PM2 daemon before restarting"
      echo "  --seed                 run seed scripts + Prisma Studio after deploy"
      echo "  --admin-email EMAIL    email for mark-admin (default: manish.mcaipu@gmail.com)"
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

# Load .env.production line-by-line so unquoted values (e.g. DATABASE_URL=postgresql://...)
# are set correctly; no sourcing so # and $ inside values are preserved.
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%"${line##*[![:space:]]}"}"
  line="${line#"${line%%[![:space:]]*}"}"
  [ -z "$line" ] && continue
  case "$line" in
    \#*) continue ;;
    [A-Za-z_]*=*)
      key="${line%%=*}"
      key="${key% }"
      value="${line#*=}"
      value="${value# }"
      # Remove surrounding single or double quotes
      case "$value" in
        \"*) value="${value#\"}"; value="${value%\"}" ;;
        \'*) value="${value#\'}"; value="${value%\'}" ;;
      esac
      export "$key=$value"
      ;;
  esac
done < "${REPO_ROOT}/.env.production"

echo "DATABASE_URL set: $([ -n "${DATABASE_URL:-}" ] && echo 'YES' || echo 'NO')"
echo "REDIS_URL set:    $([ -n "${REDIS_URL:-}" ] && echo 'YES' || echo 'NO')"

# Fail fast if DATABASE_URL points to localhost (never deploy against local DB)
if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL not set after loading .env.production." >&2
  exit 1
fi
if echo "${DATABASE_URL}" | grep -qiE 'localhost|127\.0\.0\.1'; then
  echo "FATAL: DATABASE_URL points to localhost. Use Neon production URL." >&2
  exit 1
fi
echo "DATABASE_URL host: $(echo "${DATABASE_URL}" | sed 's|.*@||' | cut -d'/' -f1)"

# ─────────────────────────────────────────────────────────────────────────────
# 3. INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────
step "3/11 — Install dependencies"
# Full install including devDeps (needed for tsc, next build, jest, prisma CLI).
# devDeps will be pruned after tests pass, before the app starts (see step 6e).
npm ci --include=dev

# ─────────────────────────────────────────────────────────────────────────────
# 4. PRISMA GENERATE + MIGRATE
# ─────────────────────────────────────────────────────────────────────────────
step "4/11 — Prisma generate + migrate"
./node_modules/.bin/prisma generate

if [ -f "${SCRIPT_DIR}/run-migrate.sh" ]; then
  bash "${SCRIPT_DIR}/run-migrate.sh"
else
  ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
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

# 6b. Prompt eval gate (hard deploy gate for tutor prompt)
step "6b — Prompt eval gate (must pass before deploy)"
if npx tsx scripts/run-prompt-eval.ts; then
  echo "Prompt eval: all assertions passed"
else
  echo "FATAL: Prompt eval failed. Deploy blocked." >&2
  exit 1
fi

# 6d. Integration tests gate
step "6d — Integration tests (must pass before deploy)"
echo "Running integration tests..."
./node_modules/.bin/jest --config jest.integration.config.cjs tests/integration/ --passWithNoTests
if [ $? -ne 0 ]; then
  echo "Integration tests failed — deploy aborted"
  exit 1
fi
echo "Integration tests passed"

# 6e. Prune devDependencies — builds and tests are done, keep prod runtime lean
step "6e — Prune devDependencies"
npm prune --omit=dev
echo "devDependencies pruned"

# 6c. Verify worker dist
step "6c — Verify worker dist"
if [ ! -f "${REPO_ROOT}/dist/worker/bootstrap.js" ]; then
  echo "FATAL: dist/worker/bootstrap.js not found. build:workers may have failed." >&2
  exit 1
fi
echo "Worker dist: OK ($(du -sh "${REPO_ROOT}/dist/worker/bootstrap.js" | cut -f1))"

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

# 9b. Redis hardening (idempotent; safe to re-run)
step "9b — Redis hardening (idempotent)"
if command -v redis-cli >/dev/null 2>&1; then
  redis-cli CONFIG SET maxmemory-policy allkeys-lru 2>/dev/null && echo "  maxmemory-policy: allkeys-lru" || echo "  WARN: redis-cli CONFIG SET maxmemory-policy failed (may need auth)"
  redis-cli CONFIG SET maxmemory 256mb 2>/dev/null || true
  redis-cli CONFIG SET save "3600 1 300 100 60 10000" 2>/dev/null || true
  redis-cli CONFIG SET appendonly yes 2>/dev/null || true
else
  echo "  redis-cli not found — skip hardening (run manually or via Redis Cloud console)"
fi

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
# 11. SEED SCRIPTS (optional, --seed flag)
# ─────────────────────────────────────────────────────────────────────────────
if [ "${SEED_FLAG}" -eq 1 ]; then
  step "11/13 — Seed scripts (mark-admin + seed-ai-content + seed-ai-data)"

  # 11a. Mark admin user
  if [ -f "${SCRIPT_DIR}/mark-admin.cjs" ]; then
    echo "  Running mark-admin for ${ADMIN_EMAIL} ..."
    node "${SCRIPT_DIR}/mark-admin.cjs" "${ADMIN_EMAIL}" || echo "  WARN: mark-admin failed (user may not exist yet)"
  fi

  # 11b. Seed academic taxonomy (boards, classes, subjects)
  if [ -f "${SCRIPT_DIR}/seed-ai-content.cjs" ]; then
    echo "  Running seed-ai-content ..."
    node "${SCRIPT_DIR}/seed-ai-content.cjs"
  fi

  # 11c. Seed dummy AI-generated content (chapters, topics, notes, questions)
  if [ -f "${SCRIPT_DIR}/seed-ai-data.cjs" ]; then
    echo "  Running seed-ai-data ..."
    # Try Node first; if it fails (Windows or env issues), attempt a PowerShell fallback.
    if node "${SCRIPT_DIR}/seed-ai-data.cjs"; then
      :
    else
      echo "  WARN: node execution failed — attempting PowerShell fallback"
      if command -v powershell >/dev/null 2>&1; then
        powershell -Command "node '${SCRIPT_DIR.replace("'","'\\''")}/seed-ai-data.cjs'" || echo "  ERROR: PowerShell fallback failed"
      else
        echo "  ERROR: PowerShell not available; seed-ai-data failed"
      fi
    fi
  fi

  # ───────────────────────────────────────────────────────────────────────────
  # 12. PRISMA STUDIO (optional, background)
  # ───────────────────────────────────────────────────────────────────────────
  step "12/13 — Prisma Studio (background on port 5555)"
  ./node_modules/.bin/prisma studio --port 5555 &
  PRISMA_STUDIO_PID=$!
  echo "  Prisma Studio started (PID ${PRISMA_STUDIO_PID}) → http://localhost:5555"
else
  echo
  echo "  (skipping seed scripts — pass --seed to enable)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 13. HEALTH CHECK + SMOKE TEST
# ─────────────────────────────────────────────────────────────────────────────
step "13/13 — Health check + smoke test"
echo "Waiting 8s for processes to stabilize..."
sleep 8

EXPECTED_PROCS=("ai-tutor-web" "content-engine-worker" "ai-tutor-scheduler")
FAILED=0

for proc in "${EXPECTED_PROCS[@]}"; do
  status=$(pm2 jlist 2>/dev/null | node -e "
    const fs = require('fs');
    const list = JSON.parse(fs.readFileSync(0, 'utf8'));
    const p = list.find(x => x.name === '${proc}');
    process.stdout.write(p ? p.pm2_env.status : 'not found');
  " 2>/dev/null || echo "unknown")
  if [ "${status}" = "online" ]; then
    echo "  ✓ ${proc}: online"
  else
    echo "  ✗ ${proc}: ${status} — run: pm2 logs ${proc} --lines 50"
    FAILED=$((FAILED + 1))
  fi
done

APP_URL="${NEXTAUTH_URL:-http://localhost:3000}"
echo ""
echo "HTTP smoke tests against ${APP_URL}:"

for endpoint in "/api/health/redis"; do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${APP_URL}${endpoint}" 2>/dev/null || echo "000")
  if [ "${http_code}" = "200" ]; then
    echo "  ✓ GET ${endpoint} → ${http_code}"
  else
    echo "  ✗ GET ${endpoint} → ${http_code}"
    FAILED=$((FAILED + 1))
  fi
done

echo
pm2 status

if [ ${FAILED} -gt 0 ]; then
  echo ""
  echo "WARNING: ${FAILED} check(s) failed. Review logs above."
  exit 1
else
  echo ""
  echo "All checks passed. Deploy complete ✓"
fi

echo
echo "Useful commands:"
echo "  pm2 logs ai-tutor-web --lines 50"
echo "  pm2 logs content-engine-worker --lines 50"
echo "  pm2 logs ai-tutor-scheduler --lines 50"
echo "  pm2 monit"
if [ "${SEED_FLAG}" -eq 1 ]; then
  echo ""
  echo "Seed & data tools:"
  echo "  Prisma Studio  → http://localhost:5555"
  echo "  Re-seed data   → node scripts/seed-ai-data.cjs"
  echo "  Mark admin     → node scripts/mark-admin.cjs <email>"
fi
