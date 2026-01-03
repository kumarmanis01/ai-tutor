#!/usr/bin/env bash
# VPS Staging Dry-Run Script (AlmaLinux)
# Purpose: Interactive, safe Phase A staging run. Does NOT enable startup on boot.
# Usage: sudo bash scripts/vps_staging_run.sh

set -euo pipefail
IFS=$'\n\t'

echo "=== AI-Tutor VPS Staging Dry-Run ==="
echo "This script will guide you through Phase A: Build-only, Web-only start, create job, Worker-only start, and verifications."
echo

read -p "Repo path on VPS (default: /srv/ai-tutor): " REPO_PATH
REPO_PATH=${REPO_PATH:-/srv/ai-tutor}
read -p "Path to .env.production (absolute, default: $REPO_PATH/.env.production): " ENV_PATH
ENV_PATH=${ENV_PATH:-$REPO_PATH/.env.production}
read -p "Git ref to deploy (branch or tag, default: origin/master): " REF
REF=${REF:-origin/master}

echo
echo "Using:" 
echo "  REPO_PATH= $REPO_PATH"
echo "  ENV_PATH=  $ENV_PATH"
echo "  REF=       $REF"
read -p "Continue with these settings? (y/N) " CONT
if [[ "${CONT,,}" != "y" ]]; then
  echo "Aborted by user."; exit 1
fi

# Basic environment checks
echo "\n-- Checking OS and prerequisites --"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "Detected OS: $NAME $VERSION" || true
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found. Install Node 20+ before proceeding. Exiting."; exit 2
fi
NODE_V=$(node -v)
echo "Node version: $NODE_V"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found. Install globally: sudo npm i -g pm2";
  read -p "Install pm2 now? (requires sudo) (y/N) " PM2I
  if [[ "${PM2I,,}" == "y" ]]; then
    sudo npm i -g pm2
  else
    echo "Please install pm2 and re-run."; exit 3
  fi
fi

# Verify repo path
if [ ! -d "$REPO_PATH" ]; then
  echo "Repo path $REPO_PATH does not exist. Create it, clone repo and re-run."; exit 4
fi
cd "$REPO_PATH"

# Check .env.production presence
if [ ! -f "$ENV_PATH" ]; then
  echo "Warning: .env.production not found at $ENV_PATH. You'll need this file for DB/REDIS access.";
  read -p "Continue anyway? (y/N) " C; if [[ "${C,,}" != "y" ]]; then exit 5; fi
else
  echo ".env.production found.";
fi

# Load env vars from .env.production for DB verification if possible
if [ -f "$ENV_PATH" ]; then
  # Export variables declared in the file (simple KEY=VALUE lines)
  set -a
  # shellcheck disable=SC1090
  . "$ENV_PATH" || true
  set +a
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
echo "\n-- Git fetch and checkout --"
git fetch origin --tags
read -p "About to checkout/ref: $REF. Proceed? (y/N) " G
if [[ "${G,,}" != "y" ]]; then echo "Abort"; exit 6; fi
# Safe checkout: create ephemeral deploy branch
git checkout -B deploy/staging "$REF"

# Ensure PM2 isn't running nodes from previous runs
echo "\n-- Stopping PM2 processes (safe) --"
pm_pid_count=$(pm2 list 2>/dev/null | wc -l || true)
pm2 stop all || true

# Install and build
echo "\n-- Install dependencies (npm ci) --"
read -p "Run 'npm ci'? (recommended) (y/N) " RUN_NPM_CI
if [[ "${RUN_NPM_CI,,}" == "y" ]]; then
  npm ci
else
  echo "Skipping npm ci as requested.";
fi

echo "\n-- Build (npm run build) --"
read -p "Run 'npm run build'? (y/N) " RUN_BUILD
if [[ "${RUN_BUILD,,}" == "y" ]]; then
  npm run build
else
  echo "Skipping build as requested.";
fi

# Stage: start web only
echo "\n-- START Web only (PM2) --"
read -p "Start web process only now? (y/N) " START_WEB
if [[ "${START_WEB,,}" == "y" ]]; then
  pm2 start ecosystem.config.js --only ai-tutor-web
  echo "Web started. Tail logs with: pm2 logs ai-tutor-web --lines 200"
  echo "Open web UI or run: curl -I http://localhost:3000"
  read -p "Have you verified the web UI and created a PENDING job from admin? (press Enter when done)" D
else
  echo "Web not started.";
fi

# Pause to let operator create a job
echo "\n-- MANUAL STEP: create one regeneration job via admin UI --"
echo "When created, note the job id or ensure it's the most recent PENDING job." 
read -p "Press Enter once you've created the job (or type 'skip' to continue without): " MAN
if [[ "${MAN,,}" == "skip" ]]; then
  echo "Continuing without local job verification.";
else
  echo "Continuing to worker start step.";
fi

# Start worker only
echo "\n-- START Worker only (PM2) --"
read -p "Start worker now? (y/N) " START_WORKER
if [[ "${START_WORKER,,}" == "y" ]]; then
  pm2 start ecosystem.config.js --only content-engine-worker
  echo "Worker started. Tail logs with: pm2 logs content-engine-worker --lines 200"
  echo "Allow a minute or two for job processing." 
else
  echo "Worker not started.";
fi

# Simulate stop/restart
echo "\n-- Optional: simulate worker stop/restart --"
read -p "Stop worker now to simulate interruption? (y/N) " STOP_NOW
if [[ "${STOP_NOW,,}" == "y" ]]; then
  pm2 stop content-engine-worker
  echo "Worker stopped. Wait a few seconds and restart when ready.";
  read -p "Restart worker now? (y/N) " RESTART_NOW
  if [[ "${RESTART_NOW,,}" == "y" ]]; then
    pm2 start ecosystem.config.js --only content-engine-worker
    echo "Worker restarted.";
  else
    echo "Worker left stopped.";
  fi
fi

# Final staging wrap
echo "\n-- STAGING RUN COMPLETE (Phase A) --"
echo "Check PM2 status: pm2 status"
echo "Check logs: pm2 logs ai-tutor-web --lines 200; pm2 logs content-engine-worker --lines 200"

echo "If all good, proceed to Phase B (production switch): run 'pm2 save' and 'pm2 startup systemd' and follow printed instructions." 

read -p "Script finished. Press Enter to exit." X
exit 0
