#!/usr/bin/env bash
set -euo pipefail

POSTGRES_IMAGE=${POSTGRES_IMAGE:-ankane/pgvector:latest}
CONTAINER_NAME=${CONTAINER_NAME:-doubtkb-perf-db}
DB_USER=${DB_USER:-perf}
DB_PASS=${DB_PASS:-perfpass}
DB_NAME=${DB_NAME:-perfdb}
HOST_PORT=${HOST_PORT:-55432}

echo "Starting temporary Postgres (pgvector) container: $CONTAINER_NAME"
docker run --name "$CONTAINER_NAME" -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB_NAME" -p "$HOST_PORT":5432 -d "$POSTGRES_IMAGE" >/dev/null

echo 'Waiting for Postgres to become ready...'
for i in {1..60}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:$HOST_PORT/$DB_NAME"
echo "DATABASE_URL set to $DATABASE_URL"

echo 'Generating Prisma client...'
npx prisma generate

echo 'Applying migrations (deploy)...'
npx prisma migrate deploy

echo 'Running DoubtKb perf benchmark...'
npm run perf:doubtkb

echo 'Benchmark finished — cleaning up container'
docker rm -f "$CONTAINER_NAME" >/dev/null
echo 'Cleanup done.'
