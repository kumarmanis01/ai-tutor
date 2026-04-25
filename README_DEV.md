# Local development with Docker (dev-only stack)

Overview

- docker-compose provides a fast local development environment with:
  - Postgres
  - Redis
  - Next.js web (hot reload)
  - Worker (BullMQ consumer) with inspector
  - Scheduler (cron + reconciler) with inspector

Quick start

1. Copy sample env and edit values (do not commit secrets):

```bash
cp .env.sample .env
# edit .env as needed
```

2. Build and run the stack:

```bash
# build and start all services (web on :3000)
make up
```

3. Run migrations (first-time):

```bash
make migrate
```

4. Attach VS Code debugger (Run > Attach to Next.js / Worker / Scheduler)

Notes
  - # The Compose setup mounts your workspace into `/workspace` in each container. The Dockerfiles cache `node_modules` and the npm cache in the configured named volumes so you get much faster rebuilds.
- The Compose setup mounts your workspace into `/workspace` in each container. The Dockerfiles cache `node_modules` in named volumes so you get much faster rebuilds.
  > > > > > > > c373b65 (chore(dev): address review comments — make check script testable, add unit test, align Docker/dev to npm, use pgvector, disable husky & inspector by default, tighten .dockerignore, remove pnpm Dockerfile, Makefile/README updates)
- If your worker/scheduler package.json scripts use different names, either add `dev:worker` / `dev:scheduler` scripts or override `command:` in `docker-compose.yml` for those services.

Performance tips (macOS / Windows)

- macOS (Apple Silicon / Intel): file sharing between the host and Docker is the usual bottleneck. Options:
  - Use Docker Desktop's "Use gRPC FUSE" / "cached" mounts for better performance.
  - For the best performance on very large repos, use tools like Mutagen (https://mutagen.io/) to sync source directories into the container.
  - Increase CPU/memory for Docker Desktop (Preferences > Resources).

- Windows (WSL2 recommended):
  - Use WSL2 as your development environment (open VS Code in WSL), then run Docker Desktop with WSL2 backend — this gives near-native IO.
  - Keep your repository inside the WSL filesystem (not on the Windows C:\ drive) to avoid slow bind mounts.

- General:
  - # Use the configured named volumes for `node_modules` and the npm cache to avoid re-installing dependencies when containers restart.
  - Use named volumes for `node_modules` (already configured) to avoid re-installing when containers restart.
    > > > > > > > c373b65 (chore(dev): address review comments — make check script testable, add unit test, align Docker/dev to npm, use pgvector, disable husky & inspector by default, tighten .dockerignore, remove pnpm Dockerfile, Makefile/README updates)
  - Avoid heavy file watchers on host (IDE plugins that watch everything) — prefer project-scoped watchers.

Troubleshooting

- If Next.js dev server doesn't start, check `docker-compose logs web` and ensure port 3000 is free on the host.
- If migrations fail, ensure `DATABASE_URL` in the container points to the `postgres` service (the compose file sets this automatically when using `.env.sample`).
