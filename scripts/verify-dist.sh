#!/usr/bin/env bash
set -e

echo "Verifying dist runtime cleanliness..."

for banned in dotenv ts-node tsconfig-paths; do
  if grep -R "${banned}" dist >/dev/null 2>&1; then
    echo "❌ Forbidden dependency in dist: ${banned}"
    exit 1
  fi
done

echo "✅ dist is production-clean"
