<!--
FILE OBJECTIVE:
- Provide Docker dev-stack troubleshooting and runbook for junior developers.

LINKED UNIT TEST:
- tests/unit/docs/docker_rules.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/ENGINEERING_PRACTICES.md

EDIT LOG:
- 2026-04-20T16:36:00Z | copilot | add runbook and headers after migration fix
- 2026-04-26T00:00:00Z | copilot | replace the old stack notes with the rebuilt hot-reload Docker workflow
-->
# Docker Hot-Reload Runbook

This runbook matches the rebuilt local Docker stack in `docker-compose.yml`.

## Step 1 - Start the stack

From `D:\projects\ai-tutor`, run:

```powershell
docker compose up --build
```

What starts:

- `postgres` on port `5432`
- `redis` on port `6379`
- `web` on port `3000`
- `worker` with `tsx watch`
- `scheduler` with `tsx watch`

The app source is bind-mounted into the containers, so edits on the host are visible immediately.

## Step 2 - Verify hot reload is working

1. Wait for `web` to print the local URL.
2. Open `http://localhost:3000`.
3. Edit a small UI file such as `app/(public)/landing-page/components/PricingSection.tsx`.
4. Confirm the browser refreshes without rebuilding the image.

For worker-side code, edit a file under `worker/` and watch the `worker` or `scheduler` logs. `tsx watch` should restart the process automatically.

## Step 3 - Useful commands

```powershell
# Start or rebuild everything
docker compose up --build

# Run in the background
docker compose up --build -d

# Stop and remove containers
docker compose down --remove-orphans

# Stop and remove containers plus named volumes
docker compose down -v --remove-orphans

# Follow logs
docker compose logs -f --tail=200

# Follow one service
docker compose logs -f web

# Check status
docker compose ps

# Run Prisma migration generation inside the web container
docker compose run --rm web npx prisma migrate dev --schema=prisma/schema.prisma
```

## Step 4 - Common fixes

- If the app says the port is busy, stop any host-side `next dev` process before starting Docker.
- If container file watching feels slow on Windows, leave `CHOKIDAR_USEPOLLING` and `WATCHPACK_POLLING` enabled; they are intentional in this setup.
- If Prisma types are stale, rerun:

```powershell
docker compose run --rm web node scripts/prisma-generate-with-retry.cjs
```

## Step 5 - Reset everything cleanly

```powershell
docker compose down -v --remove-orphans
docker compose up --build
```

This recreates Postgres, Redis, and the app containers from the current source tree.
