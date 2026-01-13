#!/usr/bin/env bash
set -euo pipefail

# Compare REDIS_URL and DATABASE_URL between two PM2 processes
WEB_NAME="ai-tutor-web"
WORKER_NAME="content-engine-worker"

read_env_from_pid() {
  local pid="$1"
  local var="$2"
  if [ -z "$pid" ] || [ "$pid" = "0" ]; then
    echo "";
    return
  fi
  # try reading without sudo first
  if sudo test -r "/proc/$pid/environ" >/dev/null 2>&1; then
    sudo tr '\0' '\n' < /proc/$pid/environ | grep -E "^${var}=" | sed -E "s/^${var}=(.*)$/\1/"
  else
    tr '\0' '\n' < /proc/$pid/environ 2>/dev/null | grep -E "^${var}=" | sed -E "s/^${var}=(.*)$/\1/" || true
  fi
}

fetch_and_print() {
  local name="$1"
  local pid
  pid=$(pm2 pid "$name" 2>/dev/null || true)
  echo "Process: $name (pm2 pid -> $pid)"
  if [ -z "$pid" ]; then
    echo "  not running or pm2 has no pid"
    echo
    return
  fi
  local redis db
  redis=$(read_env_from_pid "$pid" "REDIS_URL" ) || true
  db=$(read_env_from_pid "$pid" "DATABASE_URL" ) || true
  # trim surrounding whitespace and quotes
  trim() {
    local v="$1"
    # remove leading/trailing whitespace
    v="$(echo "$v" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    # remove surrounding single/double quotes
    if [[ "$v" =~ ^\".*\"$ ]] || [[ "$v" =~ ^\'.*\'$ ]]; then
      v="${v:1:-1}"
    fi
    printf '%s' "$v"
  }

  redis="$(trim "$redis")"
  db="$(trim "$db")"

  echo "  REDIS_URL: ${redis:-<missing>}"
  echo "  DATABASE_URL: ${db:-<missing>}"
  echo
  printf '%s\n' "$redis" "$db"
}

echo "Comparing PM2 envs for $WEB_NAME and $WORKER_NAME"
WEB_OUT=$(fetch_and_print "$WEB_NAME" | tee /dev/stderr)
WEB_REDIS=$(echo "$WEB_OUT" | sed -n '1p')
WEB_DB=$(echo "$WEB_OUT" | sed -n '2p')

WORK_OUT=$(fetch_and_print "$WORKER_NAME" | tee /dev/stderr)
WORK_REDIS=$(echo "$WORK_OUT" | sed -n '1p')
WORK_DB=$(echo "$WORK_OUT" | sed -n '2p')

echo "Summary:" 
if [ -z "$WEB_REDIS" ] && [ -z "$WORK_REDIS" ]; then
  echo "  Both processes missing REDIS_URL"
elif [ "$WEB_REDIS" = "$WORK_REDIS" ]; then
  echo "  REDIS_URL matches"
else
  echo "  REDIS_URL differs"
fi

if [ -z "$WEB_DB" ] && [ -z "$WORK_DB" ]; then
  echo "  Both processes missing DATABASE_URL"
elif [ "$WEB_DB" = "$WORK_DB" ]; then
  echo "  DATABASE_URL matches"
else
  echo "  DATABASE_URL differs"
fi

# exit 0 if both match (or both missing), else non-zero
if { [ "$WEB_REDIS" = "$WORK_REDIS" ] || { [ -z "$WEB_REDIS" ] && [ -z "$WORK_REDIS" ]; }; } && \
   { [ "$WEB_DB" = "$WORK_DB" ] || { [ -z "$WEB_DB" ] && [ -z "$WORK_DB" ]; }; }; then
  exit 0
else
  exit 2
fi
