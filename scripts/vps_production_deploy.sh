#!/usr/bin/env bash
# Robust VPS production deploy script with step-level logging and failure diagnostics
# Usage: ./vps_production_deploy.sh [REPO_PATH] [REF] [ENV_PATH]
# Example: ./vps_production_deploy.sh /srv/ai-tutor origin/master /srv/ai-tutor/.env.production

# Safety: do NOT run this from an untrusted shell. Intended for an AlmaLinux/RHEL-like VPS.

set -uo pipefail
IFS=$'\n\t'

REPO_PATH=${1:-/home/gnosiva/apps/content-engine/ai-tutor}
REF=${2:-master}
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

# run a command but avoid logging the command string (useful for secrets)
run_sensitive_step() {
  local desc="$1"
  shift
  local cmd="$*"
  echo "---- [$(date '+%Y-%m-%d %H:%M:%S')] STEP (sensitive): $desc" | tee -a "$LOG_FILE"
  # execute without writing the command to the log to avoid leaking secrets
  bash -lc "$cmd" >> "$LOG_FILE" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    echo "---- STEP FAILED: $desc (exit $rc)" | tee -a "$LOG_FILE"
    fail_and_exit $rc
  fi
  echo "---- STEP OK: $desc" | tee -a "$LOG_FILE"
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

export LOG_FILE
export REF
TS_FETCH=$(date +%s)
TMP_SCRIPT="$REPO_PATH/tmp/fetch_checkout_$TS_FETCH.sh"
cat > "$TMP_SCRIPT" <<'BASH'
#!/usr/bin/env bash
set -e
# Attempt to fetch from origin (this may fail if origin uses an SSH URL without keys)
if git fetch origin --tags >/dev/null 2>&1; then
  FETCH_REMOTE=origin
else
  echo "origin fetch failed; attempting HTTPS fallback" >> "$LOG_FILE"
  ORIG_URL=$(git config --get remote.origin.url || true)
  if [[ "$ORIG_URL" =~ ^git@github.com:(.+) ]]; then
    REPO_PATH_SUFFIX=${BASH_REMATCH[1]}
    BASE_HTTPS_URL="https://github.com/${REPO_PATH_SUFFIX}"
  else
    BASE_HTTPS_URL="$ORIG_URL"
  fi

  # Prefer PAT-based HTTPS fetch if a PAT is provided in env
  PAT_VAR=""
  if [ -n "${GITHUB_PAT:-}" ]; then PAT_VAR="GITHUB_PAT"; fi
  if [ -z "$PAT_VAR" ] && [ -n "${GITHUB_TOKEN:-}" ]; then PAT_VAR="GITHUB_TOKEN"; fi
  if [ -z "$PAT_VAR" ] && [ -n "${GH_TOKEN:-}" ]; then PAT_VAR="GH_TOKEN"; fi

  if [ -n "$PAT_VAR" ]; then
    # use temporary remote with token; do not echo token
    git remote remove tmp_fetch >/dev/null 2>&1 || true
    git remote add tmp_fetch "https://x-access-token:${!PAT_VAR}@github.com/${REPO_PATH_SUFFIX}" >/dev/null 2>&1 || true
    git -c http.sslVerify=true fetch tmp_fetch --tags
    FETCH_REMOTE=tmp_fetch
    git remote remove tmp_fetch >/dev/null 2>&1 || true
  else
    if [[ "$BASE_HTTPS_URL" =~ ^https?:// ]]; then
      git remote remove tmp_fetch >/dev/null 2>&1 || true
      git remote add tmp_fetch "$BASE_HTTPS_URL" >/dev/null 2>&1 || true
      git fetch tmp_fetch --tags >/dev/null 2>&1 || true
      FETCH_REMOTE=tmp_fetch
    else
      echo "No workable HTTPS fallback URL; continuing but fetch may be incomplete" >> "$LOG_FILE"
    fi
  fi
fi

# Decide checkout target: prefer branch (master/main) or explicit tag
if [[ "$REF" == "master" || "$REF" == "main" ]]; then
  git checkout -B deploy/prod "${FETCH_REMOTE:-origin}/$REF"
else
  if git rev-parse --verify --quiet "refs/tags/$REF" >/dev/null 2>&1; then
    git checkout -B deploy/prod "refs/tags/$REF"
  else
    git checkout -B deploy/prod "${FETCH_REMOTE:-origin}/$REF"
  fi
fi
BASH

chmod +x "$TMP_SCRIPT"
run_step "Fetch and checkout $REF (with HTTPS fallback if SSH fetch fails)" "$TMP_SCRIPT"
rm -f "$TMP_SCRIPT"

# Stop previous PM2 processes (best effort)
run_step_allow_fail "Stop all PM2 processes (best-effort)" "pm2 stop all || true"

run_step "Install production dependencies (npm ci)" "npm ci --no-audit --prefer-offline"

run_step "Prisma generate (if applicable)" "npx prisma generate"

run_step "Build workers (if-present)" "npm run build:workers --if-present"

run_step "Build Next.js (production)" "npm run build"

# Choose PM2 ecosystem file: prefer .cjs then .js
if [ -f ecosystem.config.cjs ]; then
  EC_FILE=ecosystem.config.cjs
else
  echo "No PM2 ecosystem config found (ecosystem.config.cjs). Aborting." | tee -a "$LOG_FILE"
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
