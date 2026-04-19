#!/usr/bin/env bash
set -euo pipefail

# Safe local test runner for dev machines.
# Usage: ./scripts/run-local-tests.sh
# Override env vars as needed before running.

: "${DATABASE_URL:=postgresql://postgres:postgres@127.0.0.1:5432/ai_test}"
: "${REDIS_URL:=redis://127.0.0.1:6379}"
: "${ALLOW_LLM_CALLS:=0}"
: "${HYDRATION_PAUSED:=1}"
: "${NODE_ENV:=test}"

export DATABASE_URL REDIS_URL ALLOW_LLM_CALLS HYDRATION_PAUSED NODE_ENV

echo "DATABASE_URL=$DATABASE_URL"
echo "REDIS_URL=$REDIS_URL"

echo "Running focused unit tests: xp & badges"
npx jest tests/unit/lib/student/xp.test.ts tests/unit/lib/student/badges.test.ts --runInBand --color
