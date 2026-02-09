#!/usr/bin/env bash
# VPS Staging Dry-Run Script (AlmaLinux)
# Purpose: Interactive, safe Phase A staging run. Does NOT enable startup on boot.
# Usage: sudo bash scripts/vps_staging_run.sh

set -euo pipefail
IFS=$'\n\t'

echo "=== AI-Tutor VPS Staging Dry-Run ==="
echo "This script will guide you through Phase A: Build-only, Web-only start, create job, Worker-only start, and verifications."
echo

read -p "Repo path on VPS (default: /home/gnosiva/apps/content-engine/ai-tutor): " REPO_PATH
REPO_PATH=${REPO_PATH:-/home/gnosiva/apps/content-engine/ai-tutor}
read -p "Path to .env.staging (absolute, default: $REPO_PATH/.env.staging): " ENV_PATH
ENV_PATH=${ENV_PATH:-$REPO_PATH/.env.staging}
read -p "Git ref to deploy (branch or tag, default: origin/master): " REF
REF=${REF:-origin/master}

# Logging setup
TS=$(date +%Y%m%d-%H%M%S)
LOG_DIR="$REPO_PATH/tmp/staging_logs"
# create logs with restrictive permissions
umask 077
mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR" || true
LOG_FILE="$LOG_DIR/staging-$TS.log"
touch "$LOG_FILE" && chmod 600 "$LOG_FILE" || true
# restore default umask for other operations
umask 022

echo "Using:" | tee -a "$LOG_FILE"
echo "  REPO_PATH= $REPO_PATH" | tee -a "$LOG_FILE"
echo "  ENV_PATH=  $ENV_PATH" | tee -a "$LOG_FILE"
echo "  REF=       $REF" | tee -a "$LOG_FILE"
read -p "Continue with these settings? (y/N) " CONT
echo "PROMPT: Continue with settings -> ${CONT}" | tee -a "$LOG_FILE"
if [[ "${CONT,,}" != "y" ]]; then
  echo "Aborted by user." | tee -a "$LOG_FILE"; exit 1
fi

fail_and_exit() {
  local code=${1:-1}
  echo "" | tee -a "$LOG_FILE"
  echo "ERROR: Step failed (exit $code). Tail of log:" | tee -a "$LOG_FILE"
  tail -n 200 "$LOG_FILE" | sed 's/^/    /'
 # Install and build
 echo "\n-- Install dependencies (npm ci) --" | tee -a "$LOG_FILE"
 read -p "Run 'npm ci'? (recommended) (y/N) " RUN_NPM_CI
 echo "PROMPT: Run npm ci -> ${RUN_NPM_CI}" | tee -a "$LOG_FILE"
 if [[ "${RUN_NPM_CI,,}" == "y" ]]; then
   run_step "Install dependencies (npm ci)" "npm ci"
 else
   echo "Skipping npm ci as requested." | tee -a "$LOG_FILE";
 fi

  echo "Full log: $LOG_FILE"
  exit "$code"
}

run_step() {
  local desc="$1"
  shift
  local cmd="$*"
  echo "---- [$(date '+%Y-%m-%d %H:%M:%S')] STEP: $desc" | tee -a "$LOG_FILE"
  echo "+ $cmd" >> "$LOG_FILE"
  bash -lc "$cmd" >> "$LOG_FILE" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    echo "---- STEP FAILED: $desc (exit $rc)" | tee -a "$LOG_FILE"
    fail_and_exit $rc
  fi
  echo "---- STEP OK: $desc" | tee -a "$LOG_FILE"
}

run_step_allow_fail() {
  local desc="$1"
  shift
  local cmd="$*"
  echo "---- [$(date '+%Y-%m-%d %H:%M:%S')] STEP (allow-fail): $desc" | tee -a "$LOG_FILE"
  echo "+ $cmd" >> "$LOG_FILE"
  bash -lc "$cmd" >> "$LOG_FILE" 2>&1 || {
    echo "---- STEP (allowed to fail) returned non-zero exit; continuing" | tee -a "$LOG_FILE"
  }
}

trap 'echo "Interrupted" | tee -a "$LOG_FILE"; exit 130' INT TERM

# Basic environment checks
echo "\n-- Checking OS and prerequisites --" | tee -a "$LOG_FILE"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "Detected OS: $NAME $VERSION" | tee -a "$LOG_FILE" || true
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found. Install Node 20+ before proceeding. Exiting." | tee -a "$LOG_FILE"; exit 2
fi
NODE_V=$(node -v)
echo "Node version: $NODE_V" | tee -a "$LOG_FILE"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found. Install globally: sudo npm i -g pm2" | tee -a "$LOG_FILE";
  read -p "Install pm2 now? (requires sudo) (y/N) " PM2I
  echo "PROMPT: Install pm2 -> ${PM2I}" | tee -a "$LOG_FILE"
  if [[ "${PM2I,,}" == "y" ]]; then
    run_step "Install pm2 globally" "sudo npm i -g pm2"
  else
    echo "Please install pm2 and re-run." | tee -a "$LOG_FILE"; exit 3
  fi
fi

# Verify repo path
if [ ! -d "$REPO_PATH" ]; then
  echo "Repo path $REPO_PATH does not exist. Create it, clone repo and re-run." | tee -a "$LOG_FILE"; exit 4
fi
cd "$REPO_PATH"

# Check .env.staging presence
if [ ! -f "$ENV_PATH" ]; then
  echo "Warning: .env.staging not found at $ENV_PATH. You'll need this file for DB/REDIS access." | tee -a "$LOG_FILE";
  read -p "Continue anyway? (y/N) " C; echo "PROMPT: Continue anyway -> ${C}" | tee -a "$LOG_FILE"
  if [[ "${C,,}" != "y" ]]; then exit 5; fi
else
  echo ".env.production found." | tee -a "$LOG_FILE";
fi

# Load env vars from .env.production for DB verification if possible
if [ -f "$ENV_PATH" ]; then
  # Export variables declared in the file (simple KEY=VALUE lines)
  set -a
  # shellcheck disable=SC1090
  . "$ENV_PATH" || true
  set +a
  echo "Loaded environment from $ENV_PATH" | tee -a "$LOG_FILE"
fi

# helper: run psql query if DATABASE_URL is available
run_psql() {
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL not set; skipping DB check." >&2
    return 2
  fi
  local sql="$1"
  psql "$DATABASE_URL" -t -c "$sql"
}

# helper: find latest pending regeneration job id
find_latest_pending_job() {
  if [ -z "${DATABASE_URL:-}" ]; then
    echo ""; return 1
  fi
  run_psql "SELECT id FROM regeneration_job WHERE status='PENDING' ORDER BY created_at DESC LIMIT 1;" | tr -d '[:space:]'
}

# Fetch and checkout
echo "\n-- Git fetch and checkout --" | tee -a "$LOG_FILE"
run_step "Fetch origin tags" "git fetch origin --tags"
read -p "About to checkout/ref: $REF. Proceed? (y/N) " G
echo "PROMPT: About to checkout/ref $REF -> ${G}" | tee -a "$LOG_FILE"
if [[ "${G,,}" != "y" ]]; then echo "Abort" | tee -a "$LOG_FILE"; exit 6; fi
# Safe checkout: create ephemeral deploy branch
run_step "Checkout ephemeral deploy/staging branch from $REF" "git checkout -B deploy/staging \"$REF\""

# Ensure PM2 isn't running nodes from previous runs
echo "\n-- Stopping PM2 processes (safe) --" | tee -a "$LOG_FILE"
pm_pid_count=$(pm2 list 2>/dev/null | wc -l || true)
run_step_allow_fail "Stop all PM2 processes (best-effort)" "pm2 stop all || true"

# Install and build
echo "\n-- Install dependencies (npm ci) --" | tee -a "$LOG_FILE"
read -p "Run 'npm ci'? (recommended) (y/N) " RUN_NPM_CI
echo "PROMPT: Run npm ci -> ${RUN_NPM_CI}" | tee -a "$LOG_FILE"
if [[ "${RUN_NPM_CI,,}" == "y" ]]; then
  run_step "Install dependencies (npm ci)" "npm ci"
else
  echo "Skipping npm ci as requested." | tee -a "$LOG_FILE";
fi

echo "\n-- Build (npm run build) --" | tee -a "$LOG_FILE"
read -p "Run 'npm run build'? (y/N) " RUN_BUILD
echo "PROMPT: Run npm run build -> ${RUN_BUILD}" | tee -a "$LOG_FILE"
if [[ "${RUN_BUILD,,}" == "y" ]]; then
  run_step "Build (npm run build)" "npm run build"
else
  echo "Skipping build as requested." | tee -a "$LOG_FILE";
fi

# Stage: start web only
echo "\n-- START Web only (PM2) --" | tee -a "$LOG_FILE"
read -p "Start web process only now? (y/N) " START_WEB
echo "PROMPT: Start web -> ${START_WEB}" | tee -a "$LOG_FILE"
if [[ "${START_WEB,,}" == "y" ]]; then
  EC_FILE=ecosystem.config.cjs
  run_step "Start web process via PM2 ($EC_FILE)" "pm2 start \"$EC_FILE\" --only ai-tutor-web"
  echo "Web started. Tail logs with: pm2 logs ai-tutor-web --lines 200" | tee -a "$LOG_FILE"
  echo "Open web UI or run: curl -I http://localhost:3000" | tee -a "$LOG_FILE"
  read -p "Have you verified the web UI and created a PENDING job from admin? (press Enter when done)" D
  echo "PROMPT: Verified web/create job -> ${D}" | tee -a "$LOG_FILE"
else
  echo "Web not started." | tee -a "$LOG_FILE";
fi

# Pause to let operator create a job
echo "\n-- MANUAL STEP: create one regeneration job via admin UI --" | tee -a "$LOG_FILE"
echo "When created, note the job id or ensure it's the most recent PENDING job." | tee -a "$LOG_FILE"
read -p "Press Enter once you've created the job (or type 'skip' to continue without): " MAN
echo "PROMPT: Manual job step -> ${MAN}" | tee -a "$LOG_FILE"
if [[ "${MAN,,}" == "skip" ]]; then
  echo "Continuing without local job verification." | tee -a "$LOG_FILE";
else
  echo "Continuing to worker start step." | tee -a "$LOG_FILE";
fi

# Start worker only
echo "\n-- START Worker only (PM2) --" | tee -a "$LOG_FILE"
read -p "Start worker now? (y/N) " START_WORKER
echo "PROMPT: Start worker -> ${START_WORKER}" | tee -a "$LOG_FILE"
if [[ "${START_WORKER,,}" == "y" ]]; then
  EC_FILE=ecosystem.config.cjs
  run_step "Start worker process via PM2 ($EC_FILE)" "pm2 start \"$EC_FILE\" --only content-engine-worker"
  echo "Worker started. Tail logs with: pm2 logs content-engine-worker --lines 200" | tee -a "$LOG_FILE"
  echo "Allow a minute or two for job processing." | tee -a "$LOG_FILE"
else
  echo "Worker not started." | tee -a "$LOG_FILE";
fi

# Simulate stop/restart
echo "\n-- Optional: simulate worker stop/restart --" | tee -a "$LOG_FILE"
read -p "Stop worker now to simulate interruption? (y/N) " STOP_NOW
echo "PROMPT: Stop worker -> ${STOP_NOW}" | tee -a "$LOG_FILE"
if [[ "${STOP_NOW,,}" == "y" ]]; then
  run_step "Stop worker" "pm2 stop content-engine-worker"
  echo "Worker stopped. Wait a few seconds and restart when ready." | tee -a "$LOG_FILE";
  read -p "Restart worker now? (y/N) " RESTART_NOW
  echo "PROMPT: Restart worker -> ${RESTART_NOW}" | tee -a "$LOG_FILE"
  if [[ "${RESTART_NOW,,}" == "y" ]]; then
    run_step "Restart worker" "pm2 start \"$EC_FILE\" --only content-engine-worker"
    echo "Worker restarted." | tee -a "$LOG_FILE";
  else
    echo "Worker left stopped." | tee -a "$LOG_FILE";
  fi
fi

# Final staging wrap
echo "\n-- STAGING RUN COMPLETE (Phase A) --" | tee -a "$LOG_FILE"
echo "Check PM2 status: pm2 status" | tee -a "$LOG_FILE"
echo "Check logs: pm2 logs ai-tutor-web --lines 200; pm2 logs content-engine-worker --lines 200" | tee -a "$LOG_FILE"

echo "If all good, proceed to Phase B (production switch): run 'pm2 save' and 'pm2 startup systemd' and follow printed instructions." | tee -a "$LOG_FILE"

read -p "Script finished. Press Enter to exit." X
echo "Logs saved to: $LOG_FILE" | tee -a "$LOG_FILE"
exit 0
