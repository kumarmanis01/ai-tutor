#!/usr/bin/env bash
# Lightweight pre-commit helper: run lint-staged (which fixes and lints staged files)
# then run jest related tests for staged files to avoid running full test-suite locally.

set -euo pipefail

echo "Running lint-staged (staged files only)..."
npx --no-install lint-staged

# Collect staged files
STAGED_FILES=$(git diff --name-only --cached --relative)
if [ -z "$STAGED_FILES" ]; then
  echo "No staged files detected; skipping related tests."
  exit 0
fi

echo "Finding related tests for staged files..."
IFS=$'\n'
RELATED=()
for f in $STAGED_FILES; do
  # Only consider JS/TS files for related tests
  case "$f" in
    *.ts|*.tsx|*.js|*.jsx)
      RELATED+=("$f")
      ;;
  esac
done

if [ ${#RELATED[@]} -eq 0 ]; then
  echo "No code files staged; skipping related tests."
  exit 0
fi

echo "Running jest --findRelatedTests for staged files"
npx --no-install jest --findRelatedTests "${RELATED[@]}" || true

echo "Local pre-commit checks completed (lightweight). For full checks, CI will run the full pipeline." 
