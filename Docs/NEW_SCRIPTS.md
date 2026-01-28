# New Helper Scripts

This document describes small helper scripts added to support safe container start-up and outbox dispatching.

## `scripts/run-migrate.sh`
- Purpose: wait for Postgres to be reachable and run `npx prisma migrate deploy`.
- Usage: executed by the `web` container before `next start` in `docker-compose.yml`.
- Notes: the script retries connection checks and exits non-zero if Postgres doesn't become ready.

## `scripts/outbox-dispatcher.js`
- Purpose: poll `Outbox` rows and enqueue their payloads to the BullMQ queue (`content-hydration`).
- Usage: `node scripts/outbox-dispatcher.js`
- Deployment: You may run this as a separate long-running process on the web host, or as a Cron-managed process. It reports dispatched job ids and increments attempts on failures.

## `types/shims.d.ts`
- Purpose: provide build-time TypeScript shims for optional modules like `@prisma/client`, `express` and `@kubernetes/client-node` when those are not present during image build.
- Usage: Included via `tsconfig.build.json` `typeRoots` so `tsc` has lightweight declarations.

## Test helpers
- `scripts/insert-test-hydration-and-outbox.js` (added next) — helper to insert a HydrationJob and an Outbox row to support local end-to-end testing.


## Safety & Auditing
- All scripts include a file header documenting objective, linked tests, and edit log as required by project guardrails.

