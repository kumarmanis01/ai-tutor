# DEPLOYMENT — Environment Contract

Purpose: Document the required environment variables and which process needs them for deploying `master` to a single VPS.

## Required environment variables
- `DATABASE_URL` — Postgres connection string (Neon). Required by web and worker processes.
- `NEXTAUTH_SECRET` — NextAuth secret. Required by web.
- `NEXTAUTH_URL` — Public URL for NextAuth callbacks (e.g., `https://app.example.com`). Required by web.
- `OPENAI_API_KEY` — (If your deployment uses OpenAI features) Required by worker and web features that call OpenAI (only enable if needed).
- `NODE_ENV` — `production` for runtime.
- `REDIS_URL` — Redis connection string for workers / queues (if applicable). Required by worker/orchestrator.
- `JOB_LOCK_NAMESPACE` — (optional) Namespace/prefix used by advisory locks or job registry; worker-only unless your web process intentionally acquires locks.
- `METRICS_ENABLED` — (optional) `1` or `0` to enable metrics server; worker and orchestrator may use it.
- `ORCHESTRATOR_*` and `WORKER_*` env vars — e.g., `ORCHESTRATOR_POLL_MS`, `WORKER_CONCURRENCY`, `WORKER_HEARTBEAT_MS` (optional tuning variables; worker-only).

## Which process needs which vars (summary)
- Shared (web + worker)
  - `DATABASE_URL`
  - `NODE_ENV`
  - `OPENAI_API_KEY` (if used; otherwise omit)

- Web only
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - Any HTTP-related cert/domain config (e.g., `APP_HOST`, `APP_PORT`) if used by Next.js server

- Worker / Orchestrator only
  - `REDIS_URL`
  - `WORKER_CONCURRENCY`
  - `WORKER_HEARTBEAT_MS`
  - `JOB_LOCK_NAMESPACE`
  - `ORCHESTRATOR_K8S_MODE` (should be false on VPS)
  - `METRICS_ENABLED` (optional)

## Notes and recommended .env layout
- Keep a single `.env.production` file on the VPS (outside the repo if preferred) with shared values.
- Example minimal `.env.production` (do NOT commit to repo):

```
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
REDIS_URL="redis://user:pass@host:6379"
NEXTAUTH_SECRET="<secure_random>"
NEXTAUTH_URL="https://app.example.com"
OPENAI_API_KEY="sk-..."
NODE_ENV=production
WORKER_CONCURRENCY=2
WORKER_HEARTBEAT_MS=10000
JOB_LOCK_NAMESPACE=ai-tutor-prod
METRICS_ENABLED=0
```

## Safety and separation
- Do NOT import `lib/jobs/registerJobs` into web server entrypoints — scheduled job registrations must only happen in worker/orchestrator processes. This prevents jobs from running inside Next.js server processes.
- Worker runtime explicitly enables LLM calls via `ALLOW_LLM_CALLS=1` only in worker bootstrap; web processes should not enable that.

## Runtime directories and logs (VPS)
- Application root: `/srv/ai-tutor` (example)
- `.env.production` located at `/srv/ai-tutor/.env.production`
- Logs: `logs/web-out.log`, `logs/web-error.log`, `logs/worker-out.log`, `logs/worker-error.log` (PM2 configured to use these)
- Status files: `tmp/orchestrator.status.json`, `tmp/orchestrator.*` (worker/orchestrator write status files)

## Minimal checklist for environment readiness
1. Place `.env.production` with required vars on VPS.
2. Ensure `node >= 20` is installed.
3. Ensure `pm2` is installed globally: `npm i -g pm2`.
4. Ensure DB and Redis are reachable from the VPS.

No runtime code changes are included in this document.
