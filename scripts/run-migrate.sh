#!/usr/bin/env sh
<!--
FILE OBJECTIVE:
- Wait for Postgres to become available and run Prisma migrations during container startup.

LINKED UNIT TEST:
- tests/unit/scripts/run-migrate.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-01-21T00:00:00Z | copilot-agent | created migration helper script with wait-and-deploy behaviour
-->

set -e

# Configurable via env
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
RETRIES=20
SLEEP=3

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."

i=0
while [ $i -lt $RETRIES ]; do
  if nc -z ${DB_HOST} ${DB_PORT} 2>/dev/null; then
    echo "Postgres reachable"
    break
  fi
  i=$((i+1))
  echo "Postgres not ready yet, retrying ($i/$RETRIES) in ${SLEEP}s..."
  sleep ${SLEEP}
done

if [ $i -ge $RETRIES ]; then
  echo "Postgres did not become ready after ${RETRIES} attempts"
  exit 1
fi

echo "Running Prisma migrate deploy..."
# Use npx to ensure local prisma binary is used
npx prisma migrate deploy || {
  echo "Prisma migrate deploy failed; printing schema and exiting"
  echo "----- schema.prisma -----"
  sed -n '1,200p' prisma/schema.prisma || true
  exit 1
}

echo "Prisma migrations applied"

exit 0
