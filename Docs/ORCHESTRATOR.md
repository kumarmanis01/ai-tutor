# Orchestrator — Run & Deploy

Purpose
- Runs worker processes and schedules optional jobs in non-web processes.
- Responsible for registering JobDefinitions so background jobs run only in worker processes.

Run locally (developer)
- Ensure you have `.env.local` with `DATABASE_URL` and `REDIS_URL` set.

Commands
```bash
# Start orchestrator (uses ts-node for local dev)
npm run orchestrator:start

# Or start in background (UNIX):
# nohup npm run orchestrator:start &
```

Kubernetes / Production
- Run `worker/orchestrator.ts` as a Deployment or a CronJob depending on desired behavior.
- For leader-election use `ORCHESTRATOR_K8S_MODE=1` and ensure multiple replicas can attempt leadership.
- Provide `DATABASE_URL`, `REDIS_URL`, and optionally `ORCHESTRATOR_LOCK_ID` as env vars.

Metrics & Health
- Orchestrator exposes an internal metrics server (default port `9090`):
  - `/metrics` — Prometheus metrics
  - `/health`  — JSON health including worker lifecycle counts
- Ensure Prometheus scrapes `http://<orchestrator-host>:9090/metrics`.

Job registration
- Job definitions are registered by importing `lib/jobs/registerJobs` in the orchestrator process.
- Do NOT import `lib/jobs/registerJobs` into web server code — jobs should only run in worker processes.

Notes
- Always run migrations before starting orchestrator in staging/production.
- Use `JOB_DRY_RUN=1` env var to log job activity without executing job logic for safe smoke testing.
