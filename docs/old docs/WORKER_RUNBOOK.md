<!--
FILE OBJECTIVE:
- Short runbook to start and verify the content-engine worker process (PM2 + local debugging).

LINKED UNIT TEST:
- tests/unit/docs/worker_runbook.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md
<!--
FILE OBJECTIVE:
- Short runbook to start and verify the content-engine worker process (PM2 + local debugging).

LINKED UNIT TEST:
- tests/unit/docs/worker_runbook.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-01-06T00:00:00Z | copilot | created worker runbook
-->

# Worker Runbook — Start & Verify

Minimal steps to get a single worker process running and verify it picks up jobs.

1) Start worker (PM2, production env)

```sh
# ensure .env.production contains REDIS_URL and DATABASE_URL
# PM2 will run Node against the compiled entry: dist/worker/entry.js
pm2 start ecosystem.config.cjs --only content-engine-worker --update-env
```

### PM2 restart / stop / delete commands

```sh
# Restart the worker and load updated env vars
pm2 restart content-engine-worker --update-env

# Stop the worker process
pm2 stop content-engine-worker

# Completely remove the worker from PM2
pm2 delete content-engine-worker
```

2) Start worker (one-off, dev / debug)

```sh
# Run loop entry via ts-node (local machine)
npm run start:worker

# Or run bootstrap directly (runs content-hydration worker)
npm run start:worker:bootstrap
```

3) Verify worker process

```sh
# list pm2 processes
pm2 list

# tail worker logs
pm2 logs content-engine-worker --lines 200

# quick Redis check (from host that can reach Redis)
redis-cli -u "$REDIS_URL" ping
# expect: PONG
```

4) Verify job lifecycle

- Enqueue a job from the admin UI or via a producer script.
- Watch pm2 logs; job should transition PENDING -> RUNNING -> COMPLETED.

5) Troubleshooting

- If worker never appears in `pm2 list`, ensure `ecosystem.config.cjs` is in repo root and PM2 has permission to read `.env.production`.
- If worker crashes on start, check `pm2 logs` for missing `REDIS_URL` or `DATABASE_URL` errors.
- If jobs remain PENDING but worker is RUNNING, check that `worker/bootstrap.ts` has been executed by the running process (logs contain lifecycle updates).

6) Expected failure behavior on misconfiguration

- On startup the worker entrypoint asserts `DATABASE_URL` and `REDIS_URL` exist. If either is missing the worker will log a fatal message and exit with code `1`.
- Because PM2 is configured with `autorestart: true` and `max_restarts: 10`, PM2 will attempt to restart the worker up to 10 times. After repeated failures the process will remain stopped until manual intervention.
- How to inspect and recover:

```sh
# View PM2 status (restarts, uptime, exit codes)
pm2 list

# Show detailed process info including restart count and last exit code
pm2 show content-engine-worker

# View the fatal startup logs
pm2 logs content-engine-worker --lines 200

# To stop restart loops while you fix env, stop/delete the process
pm2 stop content-engine-worker
pm2 delete content-engine-worker
```

- Recommended action when you see fatal startup exits:
	- Ensure `.env.production` contains valid `DATABASE_URL` and `REDIS_URL` (and other required secrets).
	- If the database itself is unreachable, fix DB connectivity before allowing PM2 to restart the worker.
	- After fixing env/infra, restart the worker with:

```sh
pm2 restart content-engine-worker --update-env
```
