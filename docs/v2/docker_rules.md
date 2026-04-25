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
-->

Ran terminal command: Start-Sleep -Seconds 5; docker compose ps 2>&1

Here is a complete, step-by-step guide for a junior developer to pick this up and keep it running.

---

## Current State (as of April 20, 2026)

| Container              | Image                           | Status                                      |
| ---------------------- | ------------------------------- | ------------------------------------------- |
| `ai-tutor-postgres-1`  | `ai-tutor-postgres:15-pgvector` | healthy                                     |
| `ai-tutor-redis-1`     | `redis:7-alpine`                | healthy                                     |
| `ai-tutor-web-1`       | `ai-tutor-web:prod`             | up (Next.js built and serving on port 3000) |
| `ai-tutor-worker-1`    | `ai-tutor-worker:prod`          | up                                          |
| `ai-tutor-scheduler-1` | `ai-tutor-scheduler:prod`       | up                                          |

**Root cause fixed:** The `ParentStudent` table was missing the `inactivityOptOut` column. The migration `20260417123000_add_parent_notification_and_inactivity_optout` accidentally only added it to `ParentProfile`. We:

1. Added the column directly to the running DB
2. Created a new idempotent migration: migration.sql
3. Registered it in `_prisma_migrations`

---

## Step 1 — Verify the stack is healthy

Open PowerShell in ai-tutor and run:

```powershell
docker compose ps
```

Expected output — all 5 containers should be `Up`:

```
NAME                   STATUS
ai-tutor-postgres-1    Up (healthy)
ai-tutor-redis-1       Up (healthy)
ai-tutor-web-1         Up
ai-tutor-worker-1      Up
ai-tutor-scheduler-1   Up
```

> **Note:** `web` may show `(unhealthy)` for the first ~60 minutes after a fresh start because `next build` takes ~45 minutes inside the container. This is expected — it will become healthy once the build finishes and the `/api/health/redis` endpoint returns 200.

To confirm the web app is actually serving (regardless of healthcheck):

```powershell
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Select-Object StatusCode
```

You should get `StatusCode: 200` or `301` (redirect to login). Either means the server is running.

---

## Step 2 — Check logs for errors

**Check all services at once (last 50 lines, errors only):**

```powershell
docker compose logs --tail=50 2>&1 | Select-String -Pattern "ERROR|FATAL|error"
```

**Watch live logs for a specific service:**

```powershell
# Web app
docker compose logs -f web

# Background worker
docker compose logs -f worker

# Scheduler
docker compose logs -f scheduler

# All together
docker compose logs -f
```

**Known harmless warnings to ignore:**

- `version is obsolete` — already fixed in docker-compose.override.yml
- `NOTICE: column already exists, skipping` — expected from idempotent migration
- `Update available 6.19.1 -> 7.7.0` — do NOT upgrade Prisma; it's locked to v6.19.1 per project rules

---

## Step 3 — Apply database migrations (after any schema change)

If you see errors like `column X does not exist` or `relation X does not exist`:

```powershell
# Run pending migrations
docker compose run --rm web npx prisma migrate deploy --schema=prisma/schema.prisma
```

If that fails with `P3009` (migration failed state), check which migration is stuck:

```powershell
$sql = "SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations WHERE finished_at IS NULL OR applied_steps_count = 0;"
$sql | docker compose exec -T postgres psql -U postgres -d ai_dev
```

---

## Step 4 — Restart services after a code change

```powershell
# Restart all app services (not postgres/redis)
docker compose restart web worker scheduler

# Or restart just one
docker compose restart worker
```

> **Warning:** Restarting `web` triggers a full `next build` inside the container which takes ~45 minutes. Only restart `web` if you have changed app code.

---

## Step 5 — Full reset (if everything is broken)

Only do this if you can't recover with the steps above.

```powershell
# Step A: Stop and remove all containers
docker compose down

# Step B: Drop and recreate the dev database
$sql = 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$$ai_dev$$ AND pid<>pg_backend_pid(); DROP DATABASE IF EXISTS ai_dev; CREATE DATABASE ai_dev;'
$sql | docker compose run --rm -T postgres psql -U postgres -d postgres

# Step C: Start postgres + redis first
docker compose up -d postgres redis

# Step D: Run migrations against clean DB
docker compose run --rm web npx prisma generate --schema=prisma/schema.prisma
docker compose run --rm web npx prisma migrate deploy --schema=prisma/schema.prisma

# Step E: Start the rest
docker compose up -d web worker scheduler

# Step F: Monitor the web build progress
docker compose logs -f web
```

---

## Step 6 — Make a code change (the development workflow)

1. **Edit source files** locally (they are mounted into containers via volume).
2. **For worker/scheduler changes** — just restart that service:
   ```powershell
   docker compose restart worker
   # or
   docker compose restart scheduler
   ```
3. **For web/API changes** — restart web (be aware: 45-min build):
   ```powershell
   docker compose restart web
   ```
4. **For schema changes** — create a migration file, then run deploy:

   ```powershell
   # Recommended (production-like): author SQL migrations and deploy them
   # 1. Create: prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql
   # 2. Deploy:
   docker compose run --rm web npx prisma migrate deploy --schema=prisma/schema.prisma
   ```

   Guidance on `prisma migrate dev`:
   - Prefer `npx prisma migrate deploy` inside Docker/CI and production (it only applies committed migration SQL).
   - If you need to _generate_ migration SQL locally, you may use `npx prisma migrate dev` _locally outside Docker_ to create the migration files, but you MUST review and edit the generated SQL before committing. Treat any migration file as immutable after it is committed — fixes must be shipped as a new migration.
   - Never run `npx prisma migrate dev` inside CI, inside production containers, or on production databases.

---

## Step 7 — What was changed in this session (commit these)

Files modified or created that need to be committed:

| File                        | Change                                                                     |
| --------------------------- | -------------------------------------------------------------------------- |
| migration.sql               | **New** — adds missing `inactivityOptOut` column to `ParentStudent`        |
| docker-compose.override.yml | Removed obsolete `version: '3.8'` attribute                                |
| docker-compose.yml          | Fixed web healthcheck: uses `/api/health/redis`, added `start_period: 60m` |

Commit command:

```powershell
cd D:\projects\ai-tutor
git add prisma/migrations/20260420000000_add_inactivity_opt_out_to_parent_student/migration.sql
git add docker-compose.override.yml docker-compose.yml
git commit -m "fix: add missing inactivityOptOut to ParentStudent + healthcheck start_period"
```

---

## Quick reference — useful commands

```powershell
# See all container statuses
docker compose ps

# Tail logs for one service
docker compose logs -f worker

# Run a one-off command in the web container
docker compose run --rm web npx prisma migrate deploy --schema=prisma/schema.prisma

# Execute SQL in the dev DB
$sql = 'SELECT count(*) FROM "User";'
$sql | docker compose exec -T postgres psql -U postgres -d ai_dev

# Stop everything cleanly
docker compose stop

# Restart all app services
docker compose restart web worker scheduler

# Hard reset (destroys containers, keeps images + volumes)
docker compose down
docker compose up -d
```

---

## Things you MUST NOT do

- **Never run `npx prisma migrate dev` in CI or in production containers.** If used locally to generate SQL, review the generated SQL thoroughly and commit the migration SQL file; do not rely on ephemeral database state. Prefer `npx prisma migrate deploy` for applying migrations in Docker/CI/production.
- **Never upgrade Prisma** beyond v6.19.1. The project is pinned by policy in CLAUDE.md.
- **Never edit .env.production vars** like `ENABLE_DISTRESS_DETECTION` or `NEXT_PUBLIC_CONSENT_LIVE` — they are gated by explicit approval.
- **Never push directly to `develop` or `master`** — always branch and open a PR.
- **Never commit without running:**
  ```powershell
  npx tsc --noEmit --project tsconfig.json
  ```
