#!/usr/bin/env bash
set -euo pipefail

# Debug helper: submit a syllabus job and check Postgres+Redis for hydration artifacts.
# Usage: ./scripts/debug/submit-and-check.sh [payload-json]

# load env (prefer .env.development, fall back to .env.production)
if [ -f .env.development ]; then
  set -a
  . .env.development
  set +a
fi
if [ -f .env.production ]; then
  set -a
  . .env.production
  set +a
fi

: ${DATABASE_URL:?"DATABASE_URL not set in .env.development or .env.production"}
: ${REDIS_URL:?"REDIS_URL not set in .env.development or .env.production"}

SUBMIT_URL=${SUBMIT_URL:-http://localhost:3000/api/submit-job}
PAYLOAD=${1:-'{"type":"syllabus","payload":{"title":"debug test","board":"CBSE","class":"10","subject":"math"}}'}

echo "Submitting job to $SUBMIT_URL"
resp=$(curl -s -X POST "$SUBMIT_URL" -H "Content-Type: application/json" -d "$PAYLOAD" || true)
echo "Response: $resp"

echo "Waiting 2s for DB/queue writes..."
sleep 2

if command -v psql >/dev/null 2>&1; then
  echo "Checking latest HydrationJob rows (psql via DATABASE_URL)"
  psql "$DATABASE_URL" -c "SELECT id, type, status, \"createdAt\" FROM \"HydrationJob\" ORDER BY \"createdAt\" DESC LIMIT 5;" || true
else
  echo "psql not available; install psql to run DB checks"
fi

if command -v redis-cli >/dev/null 2>&1; then
  echo "Listing Redis keys (first 200 entries)"
  # Attempt to use URL form if supported
  if redis-cli -v >/dev/null 2>&1 && echo "$REDIS_URL" | grep -q '^redis://'; then
    redis-cli -u "$REDIS_URL" --scan --pattern '*' | sed -n '1,200p' || true
  else
    # fallback to localhost:6379
    redis-cli --scan --pattern '*' | sed -n '1,200p' || true
  fi
else
  echo "redis-cli not available; install redis-cli to run Redis checks"
fi

echo "Debug script finished. Check worker logs for processing details."
