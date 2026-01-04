#!/usr/bin/env bash
# Robust VPS production deploy script with step-level logging and failure diagnostics
# Usage: ./vps_production_deploy.sh [REPO_PATH] [REF] [ENV_PATH]
# Example: ./vps_production_deploy.sh /srv/ai-tutor origin/master /srv/ai-tutor/.env.production

# Safety: do NOT run this from an untrusted shell. Intended for an AlmaLinux/RHEL-like VPS.

set -uo pipefail
IFS=$'\n\t'

REPO_PATH=${1:-/home/gnosiva/apps/content-engine/ai-tutor}
REF=${2:-origin/master}
ENV_PATH=${3:-$REPO_PATH/.env.production}

TS=$(date +%Y%m%d-%H%M%S)
LOG_DIR="$REPO_PATH/tmp/deploy_logs"
# create logs with restrictive permissions
umask 077
mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR" || true
LOG_FILE="$LOG_DIR/deploy-$TS.log"
touch "$LOG_FILE" && chmod 600 "$LOG_FILE" || true
# restore default umask for other operations
umask 022

echo "=== AI-Tutor VPS Production Deploy ===" | tee -a "$LOG_FILE"
echo "Repo: $REPO_PATH" | tee -a "$LOG_FILE"
echo "Ref:  $REF" | tee -a "$LOG_FILE"
echo "Env:  $ENV_PATH" | tee -a "$LOG_FILE"

fail_and_exit() {
  local code=${1:-1}
  echo "" | tee -a "$LOG_FILE"
  echo "ERROR: Step failed (exit $code). Tail of log:" | tee -a "$LOG_FILE"
  tail -n 200 "$LOG_FILE" | sed 's/^/    /'
  echo "Full log: $LOG_FILE"
  exit "$code"
}

run_step() {
  local desc="$1"
  shift
  local cmd="$*"
  echo "---- [$(date '+%Y-%m-%d %H:%M:%S')] STEP: $desc" | tee -a "$LOG_FILE"
  echo "+ $cmd" >> "$LOG_FILE"
  # Run the command, tee stdout/stderr to log
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

if [ ! -d "$REPO_PATH" ]; then
  echo "Repo path $REPO_PATH does not exist. Clone the repo and re-run." | tee -a "$LOG_FILE"
  exit 1
fi

cd "$REPO_PATH" || { echo "Cannot cd to $REPO_PATH" | tee -a "$LOG_FILE"; exit 2; }

if [ ! -f "$ENV_PATH" ]; then
  echo ".env.production not found at $ENV_PATH. Aborting." | tee -a "$LOG_FILE"
  exit 3
fi

run_step "Load environment file" "set -a; . \"$ENV_PATH\" || true; set +a"

run_step "Ensure git refs are available" "git fetch origin --tags"
run_step "Checkout deploy branch from $REF" "git checkout -B deploy/prod \"$REF\""

# Stop previous PM2 processes (best effort)
run_step_allow_fail "Stop all PM2 processes (best-effort)" "pm2 stop all || true"

run_step "Install production dependencies (npm ci)" "npm ci --no-audit --prefer-offline"

run_step "Prisma generate (if applicable)" "npx prisma generate"

run_step "Build workers (if-present)" "npm run build:workers --if-present"

run_step "Build Next.js (production)" "npm run build"

# Choose PM2 ecosystem file: prefer .cjs then .js
if [ -f ecosystem.config.cjs ]; then
  EC_FILE=ecosystem.config.cjs
elif [ -f ecosystem.config.js ]; then
  EC_FILE=ecosystem.config.js
else
  echo "No PM2 ecosystem config found (ecosystem.config.cjs/js). Aborting." | tee -a "$LOG_FILE"
  exit 4
fi

run_step "Reload/start PM2 using $EC_FILE" "pm2 startOrReload \"$EC_FILE\" --env production"

run_step "Save PM2 process list" "pm2 save"

# pm2 startup prints a command that needs sudo; capture and show it but don't run it
echo "---- Checking pm2 startup (captures command; do NOT run automatically)" | tee -a "$LOG_FILE"
pm2_startup_out=$(pm2 startup systemd 2>&1 | tee -a "$LOG_FILE") || true
echo "$pm2_startup_out" | tail -n 20 | sed 's/^/    /'

echo "" | tee -a "$LOG_FILE"
echo "SUCCESS: Production deploy finished." | tee -a "$LOG_FILE"
echo "PM2 status: (short)" | tee -a "$LOG_FILE"
pm2 status --no-color | tee -a "$LOG_FILE"
echo "Logs saved to: $LOG_FILE" | tee -a "$LOG_FILE"

exit 0
