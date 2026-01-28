#!/usr/bin/env bash
set -euo pipefail

# Run the compiled worker after sourcing the .env.production file.
# This avoids relying on PM2's env_file behaviour which can differ
# between PM2 versions or installations.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 2
fi

# Export variables from .env.production (ignore comments and empty lines)
while IFS= read -r line; do
  # skip empty lines and comments
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  # split on first '=' to allow '=' inside values
  IFS='=' read -r key rest <<< "$line"
  # trim surrounding whitespace from key
  key="$(echo "$key" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  # value is everything after the first '=' (preserve = in value)
  value="${line#*=}"
  # strip surrounding single/double quotes if present
  if [[ "$value" =~ ^\".*\"$ ]] || [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:-1}"
  fi

  # export safely without eval
  # Use declare -x to avoid word-splitting and ensure proper export
  declare -x "$key"="$value"
done < <(grep -v '^[[:space:]]*#' "$ENV_FILE" | sed '/^[[:space:]]*$/d')

# Determine compiled entry path (some build setups output to dist/worker/worker/entry.js)
if [ -f "$ROOT_DIR/dist/worker/worker/entry.js" ]; then
  ENTRY="$ROOT_DIR/dist/worker/worker/entry.js"
elif [ -f "$ROOT_DIR/dist/worker/entry.js" ]; then
  ENTRY="$ROOT_DIR/dist/worker/entry.js"
else
  echo "ERROR: compiled worker entry not found in dist/worker" >&2
  ls -la "$ROOT_DIR/dist/worker" || true
  exit 3
fi

echo "[run-worker] starting node $ENTRY"
exec node "$ENTRY"
