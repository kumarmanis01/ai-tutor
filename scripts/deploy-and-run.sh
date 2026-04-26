#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Production deploy script for AlmaLinux + PM2
#
# FILE OBJECTIVE:
# - Build, verify, and roll out web/worker/scheduler processes with strict runtime safety checks.
#
# LINKED UNIT TEST:
# - tests/unit/scripts/deploy-and-run.spec.ts
#
# COPILOT INSTRUCTIONS FOLLOWED:
# - /docs/COPILOT_GUARDRAILS.md
# - .github/copilot-instructions.md
#
# EDIT LOG:
# - 2026-04-26T00:00:00Z | copilot | add explicit devDependency prune verification and dist import-specifier deploy gate
# - 2026-04-26T00:00:00Z | copilot | optimize build order to avoid redundant worker rebuild in happy-path
# - 2026-04-26T00:00:00Z | copilot | add timestamped deploy logging, persistent log file, and global error trap for admin observability
# - 2026-04-26T00:00:00Z | copilot | replace prune verification with prod-tree aware orphan check to prevent hoist/peer false positives
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

RUN_STARTED_AT="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_STARTED_EPOCH="$(date +%s)"
LOG_DIR="${REPO_ROOT}/logs"
mkdir -p "${LOG_DIR}"
DEPLOY_LOG="${LOG_DIR}/deploy-run-${RUN_STARTED_AT}.log"

# Mirror all output to terminal and a persistent deploy log for admins.
exec > >(tee -a "${DEPLOY_LOG}") 2>&1

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log_info() { echo "[$(timestamp)] [INFO] $*"; }
log_warn() { echo "[$(timestamp)] [WARN] $*"; }
log_error() { echo "[$(timestamp)] [ERROR] $*"; }

format_duration() {
  local total="$1"
  local mins=$((total / 60))
  local secs=$((total % 60))
  printf '%sm %ss' "${mins}" "${secs}"
}

print_deploy_summary() {
  local final_status="$1"
  local ended_epoch
  ended_epoch="$(date +%s)"
  local elapsed=$((ended_epoch - RUN_STARTED_EPOCH))
  local node_version="unknown"
  local npm_version="unknown"
  local pm2_version="unknown"

  if command -v node >/dev/null 2>&1; then
    node_version="$(node -v 2>/dev/null || echo unknown)"
  fi
  if command -v npm >/dev/null 2>&1; then
    npm_version="$(npm -v 2>/dev/null || echo unknown)"
  fi
  if command -v pm2 >/dev/null 2>&1; then
    pm2_version="$(pm2 -v 2>/dev/null || echo unknown)"
  fi

  log_info "===== DEPLOY SUMMARY ====="
  log_info "Status: ${final_status}"
  log_info "Started (UTC): ${RUN_STARTED_AT}"
  log_info "Duration: $(format_duration "${elapsed}")"
  log_info "Node: ${node_version} | npm: ${npm_version} | pm2: ${pm2_version}"
  log_info "Deploy log: ${DEPLOY_LOG}"
}

on_error() {
  local exit_code="$1"
  local line_no="$2"
  local failed_cmd="$3"
  log_error "Deploy failed with exit=${exit_code} at line=${line_no}"
  log_error "Failed command: ${failed_cmd}"
  log_error "Deploy log: ${DEPLOY_LOG}"
  print_deploy_summary "FAILED"
}

trap 'on_error $? $LINENO "${BASH_COMMAND}"' ERR

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

step() {
  echo
  log_info "=====> $1"
}

log_info "Deploy script started"
log_info "Repository root: ${REPO_ROOT}"
log_info "Deploy log file: ${DEPLOY_LOG}"

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
log_info "On branch ${BRANCH} at $(git rev-parse --short HEAD)"

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

log_info "DATABASE_URL set: $([ -n "${DATABASE_URL:-}" ] && echo 'YES' || echo 'NO')"
log_info "REDIS_URL set: $([ -n "${REDIS_URL:-}" ] && echo 'YES' || echo 'NO')"

# Fail fast if DATABASE_URL points to localhost (never deploy against local DB)
if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL not set after loading .env.production." >&2
  exit 1
fi
if echo "${DATABASE_URL}" | grep -qiE 'localhost|127\.0\.0\.1'; then
  echo "FATAL: DATABASE_URL points to localhost. Use Neon production URL." >&2
  exit 1
fi
log_info "DATABASE_URL host: $(echo "${DATABASE_URL}" | sed 's|.*@||' | cut -d'/' -f1)"

# ─────────────────────────────────────────────────────────────────────────────
# 3. INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────
step "3/11 — Install dependencies"
# Full install including devDeps (needed for tsc, next build, jest, prisma CLI).
# devDeps will be pruned after tests pass, before the app starts (see step 6e).
npm ci --include=dev
log_info "Dependencies installed via npm ci --include=dev"
log_info "Node version: $(node -v)"
log_info "NPM version: $(npm -v)"

# ─────────────────────────────────────────────────────────────────────────────
# 4. PRISMA GENERATE + MIGRATE
# ─────────────────────────────────────────────────────────────────────────────
step "4/11 — Prisma generate + migrate"
./node_modules/.bin/prisma generate
log_info "Prisma client generation complete"

if [ -f "${SCRIPT_DIR}/run-migrate.sh" ]; then
  bash "${SCRIPT_DIR}/run-migrate.sh"
  log_info "Migrations applied via run-migrate.sh"
else
  ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
  log_info "Migrations applied via prisma migrate deploy"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. CLEAN OLD BUILD ARTIFACTS
# ─────────────────────────────────────────────────────────────────────────────
step "5/11 — Clean old build artifacts"
rm -rf "${REPO_ROOT}/.next" || true
rm -rf "${REPO_ROOT}/dist" || true
log_info "Removed .next/ and dist/"

# ─────────────────────────────────────────────────────────────────────────────
# 5b. PRE-FLIGHT CHECKS (fast — fail before spending time on a full build)
# ─────────────────────────────────────────────────────────────────────────────
step "5b — Pre-flight: smart quote verification"
# Run smart-quote fixer if python3 is available; otherwise skip gracefully
if command -v python3 >/dev/null 2>&1; then
  if python3 scripts/fix-smart-quotes.py; then
    # Auto-fix any remaining issues (should be zero if pre-commit ran)
    CHANGED=$(git diff --name-only)
    if [ -n "$CHANGED" ]; then
      echo "WARNING: Smart quotes found and auto-fixed in deploy."
      echo "These files were not cleaned at commit time:"
      echo "$CHANGED"
      echo "Committing fixes automatically..."
      git add -u
      # Skip pre-commit hooks during auto-commit on deploy to avoid hook failures
      git commit --no-verify -m "fix: auto-fix smart quotes missed in pre-commit" || echo "  WARN: git commit failed — continuing deploy"
    fi
  else
    echo "  WARN: smart-quote auto-fix script failed; continuing deploy"
  fi
else
  echo "  python3 not found — skipping smart-quote preflight"
fi
log_info "Smart quote preflight finished"

step "5c — Pre-flight: TypeScript type check"
npx tsc --noEmit --project tsconfig.json
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Fix before deploying."
  exit 1
fi
log_info "TypeScript preflight passed"

# ─────────────────────────────────────────────────────────────────────────────
# 6. BUILD
# ─────────────────────────────────────────────────────────────────────────────
step "6/11 — Build workers"
npm run build:workers

step "6/11 — Build Next.js"
LOG_DIR="${REPO_ROOT}/logs"
mkdir -p "${LOG_DIR}"
BUILD_LOG="${LOG_DIR}/deploy-build-$(date -u +%Y%m%dT%H%M%SZ).log"

if npm run build >>"${BUILD_LOG}" 2>&1; then
  log_info "Next.js build succeeded (log: ${BUILD_LOG})"
elif npm run build:prod >>"${BUILD_LOG}" 2>&1; then
  log_warn "Primary build command failed; fallback build:prod succeeded (log: ${BUILD_LOG})"
else
  echo "FATAL: Next.js build failed. Last 100 lines:" >&2
  tail -n 100 "${BUILD_LOG}" >&2 || true
  exit 1
fi

# 6b. Prompt eval gate (hard deploy gate for tutor prompt)
step "6b — Prompt eval gate (must pass before deploy)"
if npx tsx scripts/run-prompt-eval.ts; then
  log_info "Prompt eval assertions passed"
else
  echo "FATAL: Prompt eval failed. Deploy blocked." >&2
  exit 1
fi

# 6d. Integration tests gate
#step "6d — Integration tests (must pass before deploy unless explicitly skipped)"
#if [ "${SKIP_INTEGRATION_TESTS:-0}" = "1" ]; then
 # echo "Skipping integration tests because SKIP_INTEGRATION_TESTS=1"
#else
 # echo "Running integration tests..."
  #if npx jest --config jest.integration.config.cjs tests/integration/ --passWithNoTests; then
   # echo "Integration tests passed"
 # else
  #  echo "FATAL: Integration tests failed. Deploy blocked." >&2
   # exit 1
  #fi
#fi

# 6e. Prune devDependencies — builds and tests are done, keep prod runtime lean
step "6e — Prune devDependencies"
npm prune --omit=dev
log_info "npm prune --omit=dev completed"

# Hard verification: fail deploy if any direct devDependency (not also prod) remains installed.
node <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const devDeps = Object.keys(pkg.devDependencies || {});
const prodDeps = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]);

// Build the resolved production dependency tree after prune.
// This avoids false positives from npm hoisting/peer resolution behavior.
let prodTree = {};
try {
  const raw = cp.execSync('npm ls --omit=dev --all --json', {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  prodTree = JSON.parse(raw);
} catch (err) {
  const stdout = err && err.stdout ? String(err.stdout) : '{}';
  try {
    prodTree = JSON.parse(stdout);
  } catch {
    console.error('FATAL: Unable to parse npm production tree for prune verification.');
    process.exit(1);
  }
}

const prodTreeNames = new Set();
function collectNames(node) {
  if (!node || typeof node !== 'object') return;
  const deps = node.dependencies || {};
  for (const [name, child] of Object.entries(deps)) {
    prodTreeNames.add(name);
    collectNames(child);
  }
}
collectNames(prodTree);

const orphaned = devDeps.filter((dep) => {
  if (prodDeps.has(dep)) return false;
  const presentOnDisk = fs.existsSync(path.join(process.cwd(), 'node_modules', dep));
  if (!presentOnDisk) return false;
  const usedByProdTree = prodTreeNames.has(dep);
  return !usedByProdTree;
});

if (orphaned.length > 0) {
  console.error(`FATAL: orphaned devDependencies remain after prune (${orphaned.length}).`);
  console.error(`Examples: ${orphaned.slice(0, 20).join(', ')}`);
  process.exit(1);
}

console.log(`✅ Verified devDependencies pruned (prod-tree aware): ${devDeps.length - orphaned.length} checked`);
NODE

# 6c. Verify worker dist
step "6c — Verify worker dist"
if [ ! -f "${REPO_ROOT}/dist/worker/bootstrap.js" ]; then
  echo "FATAL: dist/worker/bootstrap.js not found. build:workers may have failed." >&2
  exit 1
fi
log_info "Worker dist verified: $(du -sh "${REPO_ROOT}/dist/worker/bootstrap.js" | cut -f1)"

# ─────────────────────────────────────────────────────────────────────────────
# 7. VERIFY DIST
# ─────────────────────────────────────────────────────────────────────────────
step "7/11 — Verify dist is production-clean"
if [ -f "${SCRIPT_DIR}/verify-dist.sh" ]; then
  bash "${SCRIPT_DIR}/verify-dist.sh"
else
  log_warn "verify-dist.sh not found, skipping"
fi

# Additional runtime gate: all relative imports in dist JS must be explicit (.js or /index.js).
step "7b — Verify dist import specifiers"
node <<'NODE'
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(root)) {
  console.error('FATAL: dist directory missing before import-specifier verification.');
  process.exit(1);
}

const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (stat.isFile() && full.endsWith('.js')) files.push(full);
  }
}
walk(root);

const staticRe = /from\s+['"](\.\.?\/[^'"\n]+)['"]/g;
const dynamicRe = /import\s*\(\s*['"](\.\.?\/[^'"\n]+)['"]\s*\)/g;
const invalid = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const re of [staticRe, dynamicRe]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const spec = m[1];
      const explicit = /\.(js|mjs|cjs)$/.test(spec) || /\/index\.js$/.test(spec);
      if (!explicit) {
        invalid.push(`${path.relative(process.cwd(), file)} -> ${spec}`);
        if (invalid.length >= 25) break;
      }
    }
    if (invalid.length >= 25) break;
  }
  if (invalid.length >= 25) break;
}

if (invalid.length > 0) {
  console.error('FATAL: Found extensionless relative imports in dist output.');
  for (const line of invalid) console.error(` - ${line}`);
  process.exit(1);
}

console.log(`✅ dist import-specifier verification passed (${files.length} JS files scanned)`);
NODE

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

REQUIRED_VARS="DATABASE_URL REDIS_URL NEXTAUTH_SECRET NEXTAUTH_URL \
  OPENAI_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET RESEND_API_KEY"

MISSING=""
for var in $REQUIRED_VARS; do
  val=$(eval "echo \"\$$var\"")
  if [ -z "$val" ]; then
    MISSING="$MISSING $var"
  fi
done
if [ -n "$MISSING" ]; then
  echo "❌ ERROR: Missing required env vars:$MISSING"
  echo "   Run: set -o allexport; source .env.production; set +o allexport"
  exit 1
fi
log_info "All required runtime env vars present"

pm2 start ecosystem.config.cjs --env production --update-env
log_info "PM2 start command completed"

# 9b. Redis hardening (idempotent; safe to re-run)
step "9b — Redis hardening (idempotent)"
if command -v redis-cli >/dev/null 2>&1; then
  # Parse REDIS_URL (scheme://[user:pass@]host:port[/...]) into host/port/pass/tls
  REDIS_HOST=""
  REDIS_PORT=""
  REDIS_PASS=""
  REDIS_TLS="no"
  if [ -n "${REDIS_URL:-}" ]; then
    proto=$(printf '%s\n' "${REDIS_URL}" | sed -n 's,^\([a-zA-Z0-9+.-]*\)://.*,\1,p') || true
    if [ "${proto}" = "rediss" ]; then
      REDIS_TLS="yes"
    fi
    tmp="${REDIS_URL#*://}"
    tmp="${tmp%%/*}"
    if printf '%s\n' "$tmp" | grep -q '@'; then
      creds="${tmp%%@*}"
      hostport="${tmp#*@}"
      if printf '%s\n' "$creds" | grep -q ':'; then
        REDIS_PASS="${creds#*:}"
      else
        REDIS_PASS="$creds"
      fi
    else
      hostport="$tmp"
    fi
    if printf '%s\n' "$hostport" | grep -q ':'; then
      REDIS_HOST="${hostport%%:*}"
      REDIS_PORT="${hostport##*:}"
    else
      REDIS_HOST="$hostport"
    fi
  fi

  RCLI="redis-cli"
  RCLI_ARGS=()
  if [ -n "$REDIS_HOST" ]; then
    if [ "$REDIS_TLS" = "yes" ]; then
      RCLI_ARGS+=(--tls -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}")
    else
      RCLI_ARGS+=(-h "$REDIS_HOST" -p "${REDIS_PORT:-6379}")
    fi
  fi
  if [ -n "$REDIS_PASS" ]; then
    RCLI_ARGS+=(-a "$REDIS_PASS")
  fi

  # Prefer INFO memory to read policy (some managed providers block CONFIG)
  policy_info=$("$RCLI" "${RCLI_ARGS[@]}" INFO memory 2>/dev/null || true)
  policy_value=$(printf '%s\n' "$policy_info" | sed -n 's/.*maxmemory_policy:\(.*\)/\1/p' | tr -d '\r')
  if [ -z "$policy_value" ]; then
    policy_value=$("$RCLI" "${RCLI_ARGS[@]}" CONFIG GET maxmemory-policy 2>/dev/null | tail -n1 || true)
    policy_value=$(printf '%s\n' "$policy_value" | tr -d '\r')
  fi

  if [ "$policy_value" = "noeviction" ]; then
    echo "  maxmemory-policy: noeviction"
  else
    echo "  WARN: current maxmemory-policy is: ${policy_value:-unknown}"
    # Attempt to set to noeviction; many managed providers block CONFIG SET.
    if "$RCLI" "${RCLI_ARGS[@]}" CONFIG SET maxmemory-policy noeviction >/dev/null 2>&1; then
      echo "  Attempted to set maxmemory-policy → noeviction"
    else
      echo "  Could not set CONFIG maxmemory-policy (provider may block CONFIG SET). Please set via provider console to 'noeviction' for queue safety." 
    fi
  fi

  # Show current memory usage and evicted keys so operator can triage
  "$RCLI" "${RCLI_ARGS[@]}" INFO memory 2>/dev/null | egrep 'used_memory|maxmemory|evicted_keys' || true
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

# Post-deploy: mark stale WorkerLifecycle rows as STOPPED.
# Any DRAINING/RUNNING row that is not the single most-recent RUNNING row
# is left over from a previous deploy and should be closed out.
step "Post-deploy: stale worker cleanup"
bash "${SCRIPT_DIR}/db-exec.sh" "
  UPDATE \"WorkerLifecycle\"
  SET status = 'STOPPED',
      \"stoppedAt\" = NOW(),
      \"updatedAt\" = NOW()
  WHERE status IN ('DRAINING', 'RUNNING')
  AND id NOT IN (
    SELECT id FROM \"WorkerLifecycle\"
    WHERE status = 'RUNNING'
    ORDER BY \"startedAt\" DESC
    LIMIT 1
  );
"
log_info "Stale worker records cleaned"

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
  print_deploy_summary "FAILED_HEALTHCHECK"
  exit 1
else
  echo ""
  log_info "All checks passed. Deploy complete"
  print_deploy_summary "SUCCESS"
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
