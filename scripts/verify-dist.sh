#!/usr/bin/env bash
set -e

echo "Verifying dist runtime cleanliness..."

# Only flag actual require/import calls, not mentions in comments or strings
for banned in dotenv ts-node tsconfig-paths; do
  if grep -rE "require\(['\"]${banned}['\"]|from ['\"]${banned}['\"]" dist >/dev/null 2>&1; then
    echo "❌ Forbidden dependency in dist: ${banned}"
    grep -rnE "require\(['\"]${banned}['\"]|from ['\"]${banned}['\"]" dist || true
    exit 1
  fi
done

echo "✅ dist is production-clean"
