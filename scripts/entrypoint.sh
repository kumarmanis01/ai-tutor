#!/bin/sh
set -e

echo "Entrypoint: waiting for dependent services..."

# Determine hosts
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

wait_for_postgres() {
  echo "Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
  until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" >/dev/null 2>&1; do
    sleep 1
  done
  echo "Postgres is available"
}

wait_for_redis() {
  echo "Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}..."
  until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; do
    sleep 1
  done
  echo "Redis is available"
}

# Wait for services
wait_for_postgres
wait_for_redis

# Run migrations first (so DB tables exist before build)
if [ -f /app/scripts/run-migrate.sh ]; then
  echo "Running migrations (container-start)..."
  chmod +x /app/scripts/run-migrate.sh || true
  /app/scripts/run-migrate.sh || true
fi

# Run build steps at container start (so builds happen after deps and migrations are up)
if [ -f /app/package.json ]; then
  echo "Running build (container-start) for service: ${SERVICE:-none}..."
  if [ "${SERVICE}" = "web" ]; then
    echo "Building web: full build (prisma + tsc + next build)"
    npm run build || { echo 'npm run build failed'; exit 1; }
  elif [ "${SERVICE}" = "worker" ] || [ "${SERVICE}" = "scheduler" ]; then
    echo "Building worker artifacts only"
    # build:workers already runs tsc, tsc-alias, and fix-dist-imports
    npm run build:workers || { echo 'build:workers failed'; exit 1; }
  else
    echo "No SERVICE specified or unrecognized SERVICE; skipping build steps"
  fi
fi

# Delegate to existing docker entrypoint which handles final start
if [ -f /app/docker-entrypoint.sh ]; then
  chmod +x /app/docker-entrypoint.sh || true
  exec /bin/sh /app/docker-entrypoint.sh
fi

echo "No entrypoint found; exiting"
exit 1
