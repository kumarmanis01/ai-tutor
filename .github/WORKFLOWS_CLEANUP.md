# Workflows cleanup applied

Summary of changes made on 2026-01-01:

- Consolidated `lint.yml` into `ci.yml` to avoid duplicate lint/type-check runs.
- Added the `Run ESLint custom rule tests` step to `ci.yml`.
- Scoped `ci-alert-evaluator.yml` to run only on pushes to `develop`/`master` and
  on pull requests that change files under `tests/`, `lib/`, or `prisma/`.
- Added `workflow_dispatch` to `ci-alert-evaluator.yml` for manual runs.
- Deleted the now-redundant `lint.yml` workflow file.

Why:

- Reduce CI noise and duplicate runs on PRs/pushes.
- Prevent expensive DB-backed integration tests from running on every small
  feature PR.
- Preserve manual and scheduled workflows for deploys and health checks.

If you want a different scoping policy (e.g., label-triggered runs), I can
adjust `ci-alert-evaluator.yml` to require a `run-evaluator` label on PRs.
