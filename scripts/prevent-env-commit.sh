#!/usr/bin/env bash
set -euo pipefail

# Prevent committing .env.production by checking staged files
if git rev-parse --git-dir >/dev/null 2>&1; then
  STAGED=$(git diff --name-only --cached || true)
  for f in $STAGED; do
    if [ "$f" = ".env.production" ] || [[ "$f" = "*/.env.production" ]]; then
      echo "ERROR: Attempt to commit .env.production detected. Remove it from the commit or use environment variables/secrets store." >&2
      echo "Run: git reset HEAD .env.production" >&2
      exit 1
    fi
  done
fi

exit 0
