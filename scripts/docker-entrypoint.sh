#!/bin/sh
set -e

if [ -f /app/scripts/run-migrate.sh ] && [ "$SERVICE" = "web" ]; then
  echo "Running migrations before starting web..."
  chmod +x /app/scripts/run-migrate.sh || true
  /app/scripts/run-migrate.sh
fi

case "$SERVICE" in
  web)
    echo "Starting Next.js web (next start) on port ${PORT:-3000}"
    exec npx next start -p ${PORT:-3000}
    ;;
  worker)
    echo "Starting worker: node dist/worker/worker/entry.js"
    exec node dist/worker/worker/entry.js
    ;;
  scheduler)
    echo "Starting scheduler: node dist/worker/worker/scheduler.js"
    exec node dist/worker/worker/scheduler.js
    ;;
  *)
    echo "No SERVICE specified, defaulting to Next.js start"
    exec npx next start -p ${PORT:-3000}
    ;;
esac
