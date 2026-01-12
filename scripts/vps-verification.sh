echo
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
# - 2026-01-11T00:00:00Z | copilot-agent | consolidated + quoting fixes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKIP_CONFIRM=false
if [ "${1-}" = "--yes" ] || [ "${2-}" = "--yes" ]; then
  SKIP_CONFIRM=true
fi

esc() { printf "%s" "$1" | sed "s/'/'\\''/g"; }

run_cmd() {
  local cmd="$1"
  echo
  echo "---- COMMAND STARTING ----"
  echo "$cmd"
  echo "--------------------------"
  bash -lc "$cmd"
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

cd "$PROJECT_ROOT"

echo "Step: ensure logs directory exists (scripts/ensure-logs.sh)"
if [ -x "$PROJECT_ROOT/scripts/ensure-logs.sh" ]; then
  run_cmd "bash '$PROJECT_ROOT/scripts/ensure-logs.sh'"
else
  if [ -f "$PROJECT_ROOT/scripts/ensure-logs.sh" ]; then
    run_cmd "bash '$PROJECT_ROOT/scripts/ensure-logs.sh'"
  else
    echo "Warning: scripts/ensure-logs.sh not found; create logs/ manually if needed"
  fi
fi
MD_FILE="$PROJECT_ROOT/focs/vps-verification-guide.md"

if [ -f "$MD_FILE" ]; then
  echo "Loading commands from $MD_FILE"
  # Extract only ```bash code blocks and run them in order. Each block may contain multiple lines/commands.
  mapfile -t blocks < <(awk '/^```bash/{inside=1;next} /^```/{if(inside){inside=0;print "__BLOCK_END__"} next} { if(inside){print} }' "$MD_FILE" | awk 'BEGIN{buf=""} { if($0=="__BLOCK_END__"){print buf; buf=""} else { if(buf=="") buf=$0; else buf=buf"\n"$0 } } END{ if(buf!="") print buf }')

  idx=0
  for block in "${blocks[@]}"; do
    idx=$((idx+1))
    echo
    echo "=== MD BLOCK $idx ==="
    echo "$block"
    if confirm "Run the above block now?"; then
      ESC_BLOCK=$(esc "$block")
      run_cmd "bash -lc '$ESC_BLOCK' || true"
    else
      echo "Skipped block $idx"
    fi
  done
else
  echo "MD guide not found at $MD_FILE — falling back to inline checks"
  # Fallback: run a minimal set of checks
  run_cmd "pm2 list || true"
  run_cmd "npm ci"
  run_cmd "npm run build || true"
  run_cmd "pm2 start dist/worker/entry.js --name content-engine-worker --env production --env-file '$PROJECT_ROOT/.env.production' || true"
  run_cmd "pm2 save || true"
fi
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
