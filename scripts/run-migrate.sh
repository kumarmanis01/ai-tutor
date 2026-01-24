#!/usr/bin/env sh
set -e

# FILE OBJECTIVE:
# - Wait for Postgres to become available and run Prisma migrations during container startup.
#
# LINKED UNIT TEST:
# - tests/unit/scripts/run-migrate.spec.ts
#
# COPILOT INSTRUCTIONS FOLLOWED:
# - .github/copilot-instructions.md
# - /docs/COPILOT_GUARDRAILS.md
#
# EDIT LOG:
# - 2026-01-21T00:00:00Z | copilot-agent | created migration helper script with wait-and-deploy behaviour
# - 2026-01-24T00:00:00Z | copilot-agent | parse DATABASE_URL for host/port when POSTGRES_HOST/PORT are not provided

# Configurable via env
RETRIES=20
SLEEP=3

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/.env.production"
if [ -f "$ENV_FILE" ]; then
  echo "[run-migrate] loading $ENV_FILE"
  # export all variables for the script
  set -o allexport; source "$ENV_FILE"; set +o allexport
fi

# Determine DB host/port: prefer explicit POSTGRES_HOST/POSTGRES_PORT,
# otherwise try to parse from DATABASE_URL if present.
if [ -n "$POSTGRES_HOST" ]; then
  DB_HOST="$POSTGRES_HOST"
else
  DB_HOST="localhost"
fi

if [ -n "$POSTGRES_PORT" ]; then
  DB_PORT="$POSTGRES_PORT"
else
  DB_PORT="5432"
fi

# If DB_HOST is still localhost and we have a DATABASE_URL, parse host and port
if [ "$DB_HOST" = "localhost" ] && [ -n "$DATABASE_URL" ]; then
  url_noscheme=${DATABASE_URL#*://}
  after_at=${url_noscheme#*@}
  hostport=${after_at%%/*}
  case "$hostport" in
    *:*)
      parsed_host=${hostport%%:*}
      parsed_port=${hostport#*:}
      ;;
    *)
      parsed_host="$hostport"
      parsed_port=""
      ;;
  esac
  if [ -n "$parsed_host" ]; then
    DB_HOST="$parsed_host"
  fi
  if [ -n "$parsed_port" ]; then
    DB_PORT="$parsed_port"
  fi
fi

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
