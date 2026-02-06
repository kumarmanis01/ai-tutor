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
  echo "Running build (container-start)..."
  # Ensure dev deps exist (builder stage populated node_modules)
  npm run build || true
  npm run build:workers || true
  # Ensure Next.js has a production build
  npx next build || true
fi

# Delegate to existing docker entrypoint which handles final start
if [ -f /app/docker-entrypoint.sh ]; then
  chmod +x /app/docker-entrypoint.sh || true
  exec /bin/sh /app/docker-entrypoint.sh
fi

echo "No entrypoint found; exiting"
exit 1
