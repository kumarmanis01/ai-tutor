<!--
FILE OBJECTIVE:
- Document the compile-first integration test approach used for the Alert Evaluator tests.

LINKED UNIT TEST:
- tests/integration/alert-evaluator.test.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-01-01T14:00:00Z | automation-agent | created
-->

# Compile-first integration tests (Alert Evaluator)

This project uses a compile-first approach for certain ESM/TypeScript integration tests to avoid relying on the experimental `ts-node/esm` loader in CI.

- Why: `ts-node/esm` is fragile in some CI runners and Node versions. Compiling a minimal set of files keeps the test deterministic and isolates errors.
- How it works:
  - `npx prisma generate` to generate Prisma client
  - `tsc -p tsconfig.integration.json` to compile only the integration test and its minimal runtime dependencies into `dist-integration/`
  - `node scripts/run-with-env.mjs dist-integration/tests/integration/alert-evaluator.test.js` — `run-with-env.mjs` ensures a `DATABASE_URL` is present (CI exports it at runtime) and then imports the compiled test file.

- Files of interest:
  - `tsconfig.integration.json` — targeted compile configuration (keeps emitted files minimal)
  - `scripts/run-with-env.mjs` — loads `.env.production` only when `DATABASE_URL` is not already present, then imports compiled JS
  - `tests/integration/alert-evaluator.test.ts` and `lib/alertEvaluator.ts` — the integration test + runtime under test

If you need to expand to other integration tests, add paths to `tsconfig.integration.json` and validate emitted ESM imports.
