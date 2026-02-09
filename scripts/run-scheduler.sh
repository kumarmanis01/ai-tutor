#!/usr/bin/env bash
set -euo pipefail

# Run the compiled scheduler after sourcing the .env.production file.
# Mirrors run-worker.sh; see that file for detailed comments.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 2
fi

# Export variables from .env.production (ignore comments and empty lines)
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  IFS='=' read -r key rest <<< "$line"
  key="$(echo "$key" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  value="${line#*=}"
  if [[ "$value" =~ ^\".*\"$ ]] || [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:-1}"
  fi

  declare -x "$key"="$value"
done < <(grep -v '^[[:space:]]*#' "$ENV_FILE" | sed '/^[[:space:]]*$/d')

# Determine compiled entry path
if [ -f "$ROOT_DIR/dist/worker/worker/scheduler.js" ]; then
  ENTRY="$ROOT_DIR/dist/worker/worker/scheduler.js"
elif [ -f "$ROOT_DIR/dist/worker/scheduler.js" ]; then
  ENTRY="$ROOT_DIR/dist/worker/scheduler.js"
else
  echo "ERROR: compiled scheduler entry not found in dist/worker" >&2
  ls -la "$ROOT_DIR/dist/worker" || true
  exit 3
fi

echo "[run-scheduler] starting node $ENTRY"
exec node "$ENTRY"
