#!/usr/bin/env bash
set -euo pipefail

# Load DATABASE_URL if not already in environment
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f ".env.production" ]; then
    set -o allexport
    source .env.production
    set +o allexport
  else
    echo "ERROR: DATABASE_URL not set and .env.production not found"
    exit 1
  fi
fi

# Write SQL to temp file (avoids here-string and quoting issues on AlmaLinux)
SQL_FILE=$(mktemp /tmp/spinzy-sql-XXXXXX.sql)
printf '%s' "$1" > "$SQL_FILE"

npx prisma db execute --url "$DATABASE_URL" --file "$SQL_FILE"
STATUS=$?

rm -f "$SQL_FILE"
exit $STATUS
