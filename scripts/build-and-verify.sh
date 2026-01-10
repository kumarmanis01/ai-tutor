#!/usr/bin/env bash
set -euo pipefail

# Clean production-ready build script for AlmaLinux/VPS
# - runs a clean install of deps, builds, runs tsc-alias, and verifies no `@/` aliases remain in dist/
# Usage: chmod +x scripts/build-and-verify.sh && ./scripts/build-and-verify.sh

echo "Starting build-and-verify.sh"

echo "Node: $(node -v 2>/dev/null || echo 'not installed')"
echo "NPM: $(npm -v 2>/dev/null || echo 'not installed')"

# Ensure we are in repo root
if [ ! -f package.json ]; then
  echo "Error: package.json not found. Run this script from the repo root." >&2
  exit 1
fi

# Clean node_modules and lockfile-consistent install
echo "Cleaning node_modules (if present)"
rm -rf node_modules

echo "Installing dependencies (npm ci)"
npm ci --prefer-offline --no-audit --progress=false

# Run the normal build (uses tsconfig.build.json + tsc-alias per repo scripts)
echo "Running build (npm run build)"
npm run build

# Verify compiled output has no runtime path aliases
echo "Verifying dist/ for '@/' occurrences"
if grep -R "@/" dist; then
  echo "ERROR: Found '@/' in dist output. Aborting." >&2
  exit 2
else
  echo "OK: no '@/' references in dist/"
fi

# Run repository verify script if present
if [ -f scripts/verify-dist.cjs ]; then
  echo "Running scripts/verify-dist.cjs"
  node scripts/verify-dist.cjs
fi

echo "Build and verification complete"
