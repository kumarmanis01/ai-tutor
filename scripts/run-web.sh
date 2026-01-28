#!/usr/bin/env bash
set -euo pipefail

# Safely load .env.production into the environment and run `npm start`.
# - Ignores blank lines and comments
# - Preserves values with spaces and quoted values
# - Does not use word-splitting via xargs or eval

ENV_FILE=".env.production"
if [ ! -f "${ENV_FILE}" ]; then
  echo "Env file ${ENV_FILE} not found" >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  # skip comments and blank lines
  case "$line" in
    ''|\#*) continue ;;
  esac
  # skip malformed lines
  if [[ "$line" != *=* ]]; then
    continue
  fi
  varname="${line%%=*}"
  value="${line#*=}"
  # remove surrounding single or double quotes, if any
  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:-1}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:-1}"
  fi
  export "${varname}=${value}"
done < "${ENV_FILE}"

exec npm start
