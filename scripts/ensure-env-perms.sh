#!/usr/bin/env bash
set -euo pipefail

# Ensure .env.production exists, is not tracked by git, and has safe permissions
ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "[ensure-env-perms] WARNING: ${ENV_FILE} not found in repo root" >&2
  exit 2
fi

# ensure file is not tracked by git
if git ls-files --error-unmatch "$ENV_FILE" >/dev/null 2>&1; then
  echo "[ensure-env-perms] ERROR: ${ENV_FILE} is tracked by git. Remove it from the index and rotate secrets." >&2
  echo "  git rm --cached ${ENV_FILE} && git commit -m 'chore: remove .env.production from repo'" >&2
  exit 3
fi

# set secure permissions
chmod 600 "$ENV_FILE" || true
chown $(id -u):$(id -g) "$ENV_FILE" || true

echo "[ensure-env-perms] OK: ${ENV_FILE} exists, is not tracked, and permissions set to 600"

exit 0
