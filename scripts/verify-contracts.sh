#!/bin/bash
# Run before declaring any task done.
# This is the PROTECTED CONTRACTS verification gate.
set -e

echo "=== CONTRACT VERIFICATION ==="

echo "1. Checking ALLOW_LLM_CALLS in ecosystem.config.cjs..."
if ! grep -A30 "content-engine-worker" ecosystem.config.cjs | grep -q "ALLOW_LLM_CALLS"; then
  echo "FAIL: ALLOW_LLM_CALLS missing from content-engine-worker"
  exit 1
fi
echo "   PASS"

echo "2. Checking language validator threshold..."
THRESHOLD=$(grep -o "threshold = [0-9.]*" lib/content/language-validator.ts | grep -o "[0-9.]*$")
if (( $(echo "$THRESHOLD < 0.35" | bc -l) )); then
  echo "FAIL: language validator threshold $THRESHOLD is below 0.35"
  exit 1
fi
echo "   PASS (threshold=$THRESHOLD)"

echo "3. Running type-check..."
npm run type-check
echo "   PASS"

echo "4. Running contract tests..."
node scripts/run-focused-tests.cjs -- --runInBand --testPathPattern="tests/unit/contracts/"
echo "   PASS"

echo ""
echo "=== ALL CONTRACTS VERIFIED ==="
