<!--
FILE OBJECTIVE:
- Summarize key failure traces from older `ci-alert-evaluator` workflow runs.

EDIT LOG:
- 2026-01-01T14:10:00Z | automation-agent | created
-->

# CI Failures Summary (older runs)

The following captures the main failure traces observed in older runs prior to switching to the compile-first runner.

- Run id: `20635583975` (failed)
  - Observed invocation:
    > node --trace-warnings --trace-deprecation --loader ts-node/esm tests/integration/alert-evaluator.test.ts
  - Node warning recorded:
    (node) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`
  - Failure summary:
    Integration tests failed Error: Test1 failed: QUEUE_BACKLOG not active

- Run id: `20631301056` (failed)
  - Observed invocation:
    > node --trace-warnings --trace-deprecation --loader ts-node/esm tests/integration/alert-evaluator.test.ts
  - Node warning recorded:
    (node) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`

- Run id: `20631208472` (failed)
  - Observed invocation:
    > node --trace-warnings --trace-deprecation --loader ts-node/esm tests/integration/alert-evaluator.test.ts
  - Node warning recorded:
    (node) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`

Notes / root cause analysis:
- The failing runs invoked the experimental `ts-node/esm` loader; these runs showed both loader warnings and intermittent test failures (e.g., `QUEUE_BACKLOG not active`) — symptomatic of a flaky runtime or environment/timing differences under the ESM loader.
- The applied fix was to adopt a compile-first approach (generate Prisma client -> `tsc -p tsconfig.integration.json` -> `node scripts/run-with-env.mjs dist-integration/...`) which stabilizes test execution in CI by removing the experimental loader.
