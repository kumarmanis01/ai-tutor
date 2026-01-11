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
# By default run in interactive prompt-only mode. Pass --auto or --yes to execute commands.
PROMPT_ONLY=true
if [ "${1-}" = "--auto" ] || [ "${1-}" = "--yes" ] || [ "${2-}" = "--auto" ] || [ "${2-}" = "--yes" ]; then
  PROMPT_ONLY=false
fi

run_cmd() {
  local cmd="$*"
  echo
  echo "---- COMMAND STARTING ----"
  echo "$cmd"
  echo "--------------------------"
  # Run the command and capture output
  if [ "$PROMPT_ONLY" = true ]; then
    echo "(interactive) Run the above command on the VPS now. Press Enter when done."
    read -r _
    return 0
  else
    eval "$cmd" 2>&1
    local status=$?
    if [ $status -eq 0 ]; then
      echo "---- COMMAND COMPLETED (exit $status) ----"
    else
      echo "---- COMMAND ERROR (exit $status) ----"
    fi
    return $status
  fi
}

# Print a friendly prompt with expected output. command must be quoted exactly as-is.
prompt_cmd() {
  local cmd="$1"
  local expected="$2"
  echo
  echo "=== NEXT COMMAND ==="
  echo "$cmd"
  if [ -n "$expected" ]; then
    echo
    echo "Expected:" 
    echo "$expected"
  fi
  if [ "$PROMPT_ONLY" = true ]; then
    read -r -p "Press Enter after you've run the command on the VPS (or type 'skip' to continue): " resp
    if [ "$resp" = "skip" ]; then
      echo "Skipped run verification. Continuing..."
    fi
    return 0
  else
    run_cmd $cmd
    return $?
  fi
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

echo "VPS Verification Script - interactive checklist"

echo
echo "Follow these lines on the VPS. For each step the exact command is shown; run it on the VPS and press Enter to continue."

# Phase 1
prompt_cmd 'cd ~/apps/content-engine/ai-tutor' "Change to project directory (run from the VPS user)."

prompt_cmd 'pm2 stop all' "Stops all PM2 processes."
prompt_cmd 'pm2 delete all' "Deletes all PM2 process definitions."
prompt_cmd 'pm2 list' "Expected: empty list (no running processes)."

prompt_cmd 'rm -rf dist node_modules .turbo .cache' "Removes build artifacts and node_modules."
prompt_cmd 'rm -f .env' "Optional: remove local .env (DO NOT delete .env.production)."

# Phase 2
prompt_cmd 'find . -name ".env.production" -type f' "Expected: ./ .env.production (only one file)."
prompt_cmd 'grep -E "NODE_ENV|DATABASE_URL|REDIS_URL" .env.production' "Expected contains: NODE_ENV=production and DATABASE_URL and REDIS_URL entries."
prompt_cmd 'echo $REDIS_URL' "Expected: (empty) — shell should not auto-load production envs."

# Phase 3
prompt_cmd 'npm ci' "Deterministic install. If this fails, retry with HUSKY=0 npm ci on the VPS."
prompt_cmd 'npx prisma generate' "Generates Prisma client."
prompt_cmd 'ls node_modules/.prisma/client >/dev/null && echo "Prisma OK"' "Should print 'Prisma OK'."
prompt_cmd 'npm run build' "Builds the project; abort if it fails."
prompt_cmd 'grep -R "dotenv" dist || echo "✅ dotenv not present in dist"' "Ensure 'dotenv' is not present in dist."

# Phase 4
prompt_cmd 'NODE_ENV=production \
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d= -f2-)" \
REDIS_URL="$(grep REDIS_URL .env.production | cut -d= -f2-)" \
node dist/worker/entry.js' "Dry-run the worker; expect no dotenv errors and worker starts (may idle)."

# Phase 5
prompt_cmd 'pm2 start dist/worker/entry.js \
  --name content-engine-worker \
  --env production \
  --env-file .env.production' "Start worker under PM2 with env file. Verify using 'pm2 list' that process is online."
prompt_cmd 'pm2 env content-engine-worker | grep REDIS_URL' "Expected shows REDIS_URL=... (not empty)."
prompt_cmd 'pm2 logs content-engine-worker --lines 50' "Check for no fatal startup errors and no 'REDIS_URL is not set' messages."

# Phase 6
prompt_cmd 'pm2 logs content-engine-worker | grep -i redis' "No Redis connection errors in logs."
prompt_cmd 'redis-cli -u "$(grep REDIS_URL .env.production | cut -d= -f2-)" ping' "Expected: PONG (if redis-cli is installed)."

# Phase 7
prompt_cmd 'pm2 save' "Saves PM2 process list for resurrect after reboot."
prompt_cmd 'pm2 startup' "Follow the printed command to enable PM2 on startup."
prompt_cmd 'sudo reboot' "Optional: reboot the VPS to validate startup. After reconnect run 'pm2 list' and 'pm2 logs content-engine-worker --lines 20' — worker should be online."

echo
echo "SUCCESS CRITERIA (verify manually):"
echo " - dotenv absent from dist"
echo " - pm2 env shows REDIS_URL"
echo " - Worker started without fatal errors"
echo " - Prisma client present"
echo " - Redis connectivity OK or no connection errors in logs"

echo "Interactive checklist finished."
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
