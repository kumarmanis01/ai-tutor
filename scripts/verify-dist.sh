#!/usr/bin/env bash
set -e

# Delegate to the Node.js verifier which strips comments and uses proper patterns.
# Falls back to a basic grep check if node is unavailable.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v node >/dev/null 2>&1 && [ -f "${SCRIPT_DIR}/verify-dist.cjs" ]; then
  node "${SCRIPT_DIR}/verify-dist.cjs"
else
  echo "Verifying dist runtime cleanliness (basic mode)..."
  for banned in dotenv ts-node tsconfig-paths; do
    if grep -rE "require\(['\"]${banned}['\"]|from ['\"]${banned}['\"]" dist >/dev/null 2>&1; then
      echo "❌ Forbidden dependency in dist: ${banned}"
      grep -rnE "require\(['\"]${banned}['\"]|from ['\"]${banned}['\"]" dist || true
      exit 1
    fi
  done
  echo "✅ dist is production-clean"
fi
