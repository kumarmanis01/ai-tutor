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

exec node dist/worker/entry.js
