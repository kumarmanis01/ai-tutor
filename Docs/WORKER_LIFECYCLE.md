# Worker Lifecycle and Controller Model

Overview

- Workers are long-lived execution capacity that pull jobs from queues.
- Jobs are work items and must NOT start or stop workers.
- A controller (admin or autoscaler) manages worker lifecycles independently from jobs.

Principles

- Jobs trigger demand signals, not worker lifecycles.
- Worker lifecycle rows (`WorkerLifecycle`) are the canonical source-of-truth for worker processes.
- Workers must heartbeat and be observable (startedAt, stoppedAt, lastHeartbeatAt, status).
- Admin or an autoscaler is responsible for creating `WorkerLifecycle` rows and starting processes/containers.

Valid Start Triggers

1. Manual (Admin) — recommended for MVP
   - Admin creates a lifecycle row via `POST /api/admin/workers` with `action=start` and receives `lifecycleId`.
   - Orchestrator or operator spawns the process/container for that lifecycle id.

2. Autoscaler (Controller) — Phase 2/3
   - Controller monitors queue depth/latency and decides to create lifecycle rows or spawn workers.
   - Controller owns lifecycle state transitions.

3. Local Dev
   - Developers may run `node -r ts-node/register worker/bootstrap.ts --type <type>` which will create its own lifecycle row when `--lifecycleId` is not provided.

Key Invariants

- Jobs never start or stop workers.
- Workers must be lifecycle-managed by a single controller to avoid races.
- Workers must update their lifecycle row on startup and heartbeat regularly.
- Admin actions must create audit logs and include `reason` metadata.

Admin API

- `GET /api/admin/workers` — lists recent lifecycle rows.
- `POST /api/admin/workers` — accepts `action=start|stop`.
  - On `start` returns `{ lifecycleId }` for operator/orchestrator use.

Orchestrator

- The orchestrator watches for `WorkerLifecycle` rows in `STARTING` state.
- For each row it spawns a process/container and passes `--lifecycleId` to the worker bootstrap so the worker attaches to the existing lifecycle row.
- In k8s mode the orchestrator reconciles by creating k8s Jobs instead of local processes.

Developer guidance

- To start an orchestrator locally:

```bash
npm run orchestrator:start
```

- To run a worker manually (dev):

```bash
node -r ts-node/register worker/bootstrap.ts --type content-hydration --concurrency 2
```

- To start a worker via admin API (then let orchestrator spawn it):

```bash
curl -X POST -H "Content-Type: application/json" -d '{"action":"start","type":"content-hydration","reason":"scale up"}' http://localhost:3000/api/admin/workers
# returns {"lifecycleId":"wk-...","type":"content-hydration"}
```

If you want, I can add a short admin UI panel that creates the lifecycle row and shows the returned `lifecycleId` so operators can copy it for local testing.
