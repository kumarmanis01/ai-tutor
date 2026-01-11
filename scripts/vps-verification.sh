#!/usr/bin/env bash
# FILE OBJECTIVE:
# - Guided VPS verification script that runs a production-grade checklist
#   and prints start/completed/error feedback for each step.
#
# LINKED UNIT TEST:
# - tests/unit/docs/vps_verification.spec.ts
#
# COPILOT INSTRUCTIONS FOLLOWED:
# - .github/copilot-instructions.md
# - /docs/COPILOT_GUARDRAILS.md
#
# EDIT LOG:
# - 2026-01-11T00:00:00Z | copilot-agent | updated with Node/Husky/PM2 fallbacks

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Project root is the parent of the scripts directory
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$PROJECT_ROOT"
SKIP_CONFIRM=false
if [ "${1-}" = "--yes" ] || [ "${2-}" = "--yes" ]; then
  SKIP_CONFIRM=true
fi

run_cmd() {
  local cmd="$*"
  echo
  echo "---- COMMAND STARTING ----"
  echo "$cmd"
  echo "--------------------------"
  # Run the command and capture output
  eval "$cmd" 2>&1
  local status=$?
  if [ $status -eq 0 ]; then
    echo "---- COMMAND COMPLETED (exit $status) ----"
  else
    echo "---- COMMAND ERROR (exit $status) ----"
  fi
  return $status
}

confirm() {
  if [ "$SKIP_CONFIRM" = true ]; then
    return 0
  fi
  read -r -p "$1 [y/N]: " resp
  case "$resp" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

echo "VPS Verification Script - follow the prompts and watch outputs"

echo "PHASE 1 — Clean slate"
cd "$ROOT_DIR"

if confirm "Stop and delete all PM2 processes (pm2 stop all && pm2 delete all)? This is destructive."; then
  run_cmd pm2 stop all
  run_cmd pm2 delete all
else
  echo "Skipped PM2 stop/delete"
fi

run_cmd pm2 list

echo "PHASE 1 Verify: pm2 list should be empty above"

echo "2️⃣ Clean build artifacts"
if confirm "Remove dist, node_modules .turbo .cache and optionally .env (do NOT remove .env.production). Continue?"; then
  run_cmd rm -rf dist node_modules .turbo .cache
  echo "(optional) Remove .env local file only"
  if [ -f .env ]; then
    if confirm "Remove local .env file?"; then
      run_cmd rm -f .env
    else
      echo "Kept .env"
    fi
  else
    echo ".env not present, skipping"
  fi
else
  echo "Skipped cleaning artifacts"
fi

echo "PHASE 2 — Environment sanity check"
run_cmd find "$PROJECT_ROOT" -maxdepth 2 -name ".env.production" -type f || true

echo "Verify .env.production key vars"
# Run grep from project root so the simple relative command works as expected
# Use single-quoted sh -c with embedded double-quotes so the pattern is preserved
run_cmd sh -c 'cd "'""$PROJECT_ROOT"'"' && grep -E "NODE_ENV|DATABASE_URL|REDIS_URL" .env.production' || true

echo "Confirm shell does not auto-load env (expected empty):"
run_cmd sh -c 'echo \$REDIS_URL'

echo "PHASE 3 — Install & Build"
echo "Checking Node.js version (require >=20)"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "ERROR: Node.js >=20 required. Found $(node -v). Aborting."
    exit 1
  fi
else
  echo "ERROR: node not found in PATH. Aborting."
  exit 1
fi

# Attempt deterministic install, with Husky fallback if prepare hook fails
run_cmd npm ci || {
  echo "npm ci failed; retrying with Husky disabled (HUSKY=0)"
  run_cmd HUSKY=0 npm ci || {
    echo "npm ci retry failed; retrying with dev deps omitted (HUSKY=0 npm ci --omit=dev)"
    run_cmd HUSKY=0 npm ci --omit=dev || { echo "npm ci all retries failed - aborting"; exit 1; }
  }
}

run_cmd npx prisma generate
run_cmd sh -c 'ls node_modules/.prisma/client >/dev/null && echo "Prisma OK" || echo "Prisma NOT found"'

run_cmd npm run build || { echo "Build failed - stop and paste error output"; exit 1; }

# Ensure Next.js production build exists
if [ -d ".next" ]; then
  echo ".next directory found"
else
  echo "ERROR: .next directory missing after build. Web build failed. Aborting."
  exit 1
fi

run_cmd sh -c 'grep -R "dotenv" dist || echo "✅ dotenv not present in dist"'

echo "PHASE 4 — Dry-run worker"
DB_URL=$(grep -m1 '^DATABASE_URL=' "$PROJECT_ROOT/.env.production" | cut -d= -f2- | sed 's/^"//;s/"$//') || DB_URL=""
REDIS_URL_VAL=$(grep -m1 '^REDIS_URL=' "$PROJECT_ROOT/.env.production" | cut -d= -f2- | sed 's/^"//;s/"$//') || REDIS_URL_VAL=""

echo "Running worker: node dist/worker/entry.js with env vars from .env.production"
if [ ! -f dist/worker/entry.js ]; then
  echo "ERROR: dist/worker/entry.js not found — build may have failed. Aborting."; exit 1
fi

# Dry-run in background for smoke validation
run_cmd sh -c "NODE_ENV=production DATABASE_URL=\"$DB_URL\" REDIS_URL=\"$REDIS_URL_VAL\" node dist/worker/entry.js &" || true
echo "Worker started in background for smoke-run (use Ctrl+C in manual run to stop)."

echo "PHASE 5 — PM2 start the worker with env-file"
# Prefer pm2 --env-file if available; fallback to exporting envs into shell
run_cmd pm2 start dist/worker/entry.js --name content-engine-worker --env production --env-file "$PROJECT_ROOT/.env.production" || {
  echo "pm2 start with --env-file failed; attempting export fallback"
  # Export all variables from .env.production into this shell, then start
  set -a
  # shellcheck disable=SC1091
  [ -f "$PROJECT_ROOT/.env.production" ] && source "$PROJECT_ROOT/.env.production"
  set +a
  run_cmd pm2 start dist/worker/entry.js --name content-engine-worker --env production || true
}

run_cmd pm2 list

echo "Verify PM2 env injection for worker"
run_cmd pm2 env content-engine-worker | grep REDIS_URL || echo "WARN: pm2 env content-engine-worker did not show REDIS_URL. Verify pm2 version and --env-file support or use set -a export fallback."

echo "Check worker logs (last 50 lines)"
run_cmd pm2 logs content-engine-worker --lines 50 || true

echo "PHASE 6 — Redis connectivity check (logs + optional redis-cli ping)"
run_cmd pm2 logs content-engine-worker | grep -i redis || true
if command -v redis-cli >/dev/null 2>&1; then
  run_cmd sh -c "redis-cli -u \"$REDIS_URL_VAL\" ping || true"
else
  echo "redis-cli not installed; skipping direct ping"
fi

echo "PHASE 6.5 — Verify web PM2 process (ai-tutor-web)"
# Check if ai-tutor-web is already managed
if pm2 list | grep -q "ai-tutor-web"; then
  echo "ai-tutor-web is present in pm2 list"
else
  echo "ai-tutor-web not found in pm2 list — attempting to start using npm start"
  run_cmd pm2 start npm --name ai-tutor-web -- start --env production --env-file "$PROJECT_ROOT/.env.production" || {
    echo "pm2 start npm -- start --env-file failed — attempting export fallback"
    set -a
    [ -f "$PROJECT_ROOT/.env.production" ] && source "$PROJECT_ROOT/.env.production"
    set +a
    run_cmd pm2 start npm --name ai-tutor-web -- start --env production || true
  }
fi

echo "Check ai-tutor-web status"
run_cmd pm2 status ai-tutor-web || true
run_cmd pm2 logs ai-tutor-web --lines 50 || true

echo "PHASE 7 — Persistence & reboot safety"
run_cmd pm2 save
run_cmd pm2 startup || true

echo "END: To test reboot behavior, run: sudo reboot  (optional) and then verify: pm2 list && pm2 logs content-engine-worker --lines 20"

echo
echo "SUCCESS CRITERIA (verify manually):"
echo " - dotenv absent from dist (grep returned no results)"
echo " - pm2 env shows REDIS_URL"
echo " - Worker started without fatal errors"
echo " - Prisma client present"
echo " - Redis connectivity OK or no connection errors in logs"

echo "Script finished"
#!/usr/bin/env bash
# FILE OBJECTIVE:
# - Guided VPS verification script that runs a production-grade checklist
#   and prints start/completed/error feedback for each step.
#
# LINKED UNIT TEST:
# - tests/unit/docs/vps_verification.spec.ts
#
# COPILOT INSTRUCTIONS FOLLOWED:
# - .github/copilot-instructions.md
# - /docs/COPILOT_GUARDRAILS.md
#
# EDIT LOG:
# - 2026-01-11T00:00:00Z | copilot-agent | created

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Project root is the parent of the scripts directory
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$PROJECT_ROOT"
SKIP_CONFIRM=false
if [ "${1-}" = "--yes" ] || [ "${2-}" = "--yes" ]; then
  SKIP_CONFIRM=true
fi

run_cmd() {
  local cmd="$*"
  echo
  echo "---- COMMAND STARTING ----"
  echo "$cmd"
  echo "--------------------------"
  # Run the command and capture output
  eval "$cmd" 2>&1
  local status=$?
  if [ $status -eq 0 ]; then
    echo "---- COMMAND COMPLETED (exit $status) ----"
  else
    echo "---- COMMAND ERROR (exit $status) ----"
  fi
  return $status
}

confirm() {
  if [ "$SKIP_CONFIRM" = true ]; then
    return 0
  fi
  read -r -p "$1 [y/N]: " resp
  case "$resp" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

echo "VPS Verification Script - follow the prompts and watch outputs"

echo "PHASE 1 — Clean slate"
cd "$ROOT_DIR"

if confirm "Stop and delete all PM2 processes (pm2 stop all && pm2 delete all)? This is destructive."; then
  run_cmd pm2 stop all
  run_cmd pm2 delete all
else
  echo "Skipped PM2 stop/delete"
fi

run_cmd pm2 list

echo "PHASE 1 Verify: pm2 list should be empty above"

echo "2️⃣ Clean build artifacts"
if confirm "Remove dist, node_modules, .turbo, .cache and optionally .env (do NOT remove .env.production). Continue?"; then
  run_cmd rm -rf dist node_modules .turbo .cache
  echo "(optional) Remove .env local file only"
  if [ -f .env ]; then
    if confirm "Remove local .env file?"; then
      run_cmd rm -f .env
    else
      echo "Kept .env"
    fi
  else
    echo ".env not present, skipping"
  fi
else
  echo "Skipped cleaning artifacts"
fi

echo "PHASE 2 — Environment sanity check"
run_cmd find "$PROJECT_ROOT" -maxdepth 2 -name ".env.production" -type f || true

echo "Verify .env.production key vars"
# Run grep from project root so the simple relative command works as expected
# Use single-quoted sh -c with embedded double-quotes so the pattern is preserved
run_cmd sh -c 'cd "'"$PROJECT_ROOT"'" && grep -E "NODE_ENV|DATABASE_URL|REDIS_URL" .env.production' || true

echo "Confirm shell does not auto-load env (expected empty):"
run_cmd sh -c 'echo \$REDIS_URL'

echo "PHASE 3 — Install & Build"
run_cmd npm ci

run_cmd npx prisma generate
run_cmd sh -c 'ls node_modules/.prisma/client >/dev/null && echo "Prisma OK" || echo "Prisma NOT found"'

run_cmd npm run build || { echo "Build failed - stop and paste error output"; exit 1; }

run_cmd sh -c 'grep -R "dotenv" dist || echo "✅ dotenv not present in dist"'

echo "PHASE 4 — Dry-run worker"
DB_URL=$(grep -m1 '^DATABASE_URL=' "$PROJECT_ROOT/.env.production" | cut -d= -f2- | sed 's/^"//;s/"$//') || DB_URL=""
REDIS_URL_VAL=$(grep -m1 '^REDIS_URL=' "$PROJECT_ROOT/.env.production" | cut -d= -f2- | sed 's/^"//;s/"$//') || REDIS_URL_VAL=""

echo "Running worker: node dist/worker/entry.js with env vars from .env.production"
run_cmd sh -c "NODE_ENV=production DATABASE_URL=\"$DB_URL\" REDIS_URL=\"$REDIS_URL_VAL\" node dist/worker/entry.js &"
echo "Worker started in background for smoke-run (use Ctrl+C in manual run to stop)."

echo "PHASE 5 — PM2 start the worker with env-file"
run_cmd pm2 start dist/worker/entry.js --name content-engine-worker --env production --env-file "$PROJECT_ROOT/.env.production" || true

run_cmd pm2 list

echo "Verify PM2 env injection for worker"
run_cmd pm2 env content-engine-worker | grep REDIS_URL || true

echo "Check worker logs (last 50 lines)"
run_cmd pm2 logs content-engine-worker --lines 50 || true

echo "PHASE 6 — Redis connectivity check (logs + optional redis-cli ping)"
run_cmd pm2 logs content-engine-worker | grep -i redis || true
if command -v redis-cli >/dev/null 2>&1; then
  run_cmd sh -c "redis-cli -u \"$REDIS_URL_VAL\" ping || true"
else
  echo "redis-cli not installed; skipping direct ping"
fi

echo "PHASE 7 — Persistence & reboot safety"
run_cmd pm2 save
run_cmd pm2 startup || true

echo "END: To test reboot behavior, run: sudo reboot  (optional) and then verify: pm2 list && pm2 logs content-engine-worker --lines 20"

echo
echo "SUCCESS CRITERIA (verify manually):"
echo " - dotenv absent from dist (grep returned no results)"
echo " - pm2 env shows REDIS_URL"
echo " - Worker started without fatal errors"
echo " - Prisma client present"
echo " - Redis connectivity OK or no connection errors in logs"

echo "Script finished"
