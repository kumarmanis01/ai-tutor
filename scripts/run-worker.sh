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
set -a
# shellcheck disable=SC2046
eval $(grep -v '^[[:space:]]*#' "$ENV_FILE" | sed -E 's/([[:alnum:]_]+)=(.*)/export \1="\2"/g')
set +a

exec node dist/worker/entry.js
