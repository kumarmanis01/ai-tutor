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
RETRIES=${RETRIES:-10}
SLEEP=${SLEEP:-5}

# Log directory for migrate attempts
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
MIGRATE_LOG="$LOG_DIR/migrate-$(date -u +%Y%m%dT%H%M%SZ).log"

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/.env.production"
# Only load .env.production if DATABASE_URL is not already set (e.g., by docker-compose)
if [ -f "$ENV_FILE" ] && [ -z "$DATABASE_URL" ]; then
  echo "[run-migrate] loading $ENV_FILE"
  # export all variables for the script (POSIX-friendly)
  # normalize line endings in the env file (may have CRLF on Windows hosts)
  sed -i 's/\r$//' "$ENV_FILE" || true
  set -a
  . "$ENV_FILE"
  set +a
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

# Try running migrate with retry/backoff. If a lock (P1002) occurs, attempt to call
# `pg_advisory_unlock_all()` via psql if available and retry.
attempt=1
while [ $attempt -le $RETRIES ]; do
  echo "[run-migrate] attempt $attempt/$RETRIES: running prisma migrate deploy (logs: $MIGRATE_LOG)"
  if npx prisma migrate deploy >>"$MIGRATE_LOG" 2>&1; then
    echo "[run-migrate] prisma migrate deploy: OK"
    echo "[run-migrate] full log: $MIGRATE_LOG"
    break
  else
    echo "[run-migrate] prisma migrate failed on attempt $attempt (see $MIGRATE_LOG)"
    # Print short tail for quick debugging
    tail -n 80 "$MIGRATE_LOG" || true
    # Attempt advisory unlock if psql is available and DATABASE_URL is set
    if command -v psql >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
      echo "[run-migrate] attempting pg_advisory_unlock_all() via psql"
      # Run in a subshell to avoid leaking credentials; psql will parse DATABASE_URL
      psql "$DATABASE_URL" -c "SELECT pg_advisory_unlock_all();" >>"$MIGRATE_LOG" 2>&1 || true
    fi
    attempt=$((attempt+1))
    if [ $attempt -le $RETRIES ]; then
      sleep_time=$((SLEEP * attempt))
      echo "[run-migrate] sleeping ${sleep_time}s before retry"
      sleep ${sleep_time}
    else
      echo "[run-migrate] exceeded max attempts ($RETRIES). Printing last 200 lines of migrate log:" >&2
      tail -n 200 "$MIGRATE_LOG" >&2 || true
      echo "----- schema.prisma -----"
      sed -n '1,200p' prisma/schema.prisma || true
      exit 1
    fi
  fi
done

echo "Prisma migrations applied"

exit 0
