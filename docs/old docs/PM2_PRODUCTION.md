<!--
FILE OBJECTIVE:
- Document PM2 production startup and recommended runtime config for ai-tutor.

LINKED UNIT TEST:
- tests/unit/docs/pm2_production.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md

EDIT LOG:
- 2026-01-11T00:00:00Z | assistant | added PM2 production guidance and start script
-->

**PM2 Production Startup**

- **Start script:** Use `scripts/pm2-start.sh` to install `pm2` if missing, start processes defined in `ecosystem.config.cjs` with the `production` env, persist the process list, and generate a systemd startup hook.
- Run from repo root:

  - `chmod +x scripts/pm2-start.sh`
  - `sudo scripts/pm2-start.sh`

**Recommended runtime config changes**

- `ecosystem.config.cjs`:
  - Keep `env_file: '.env.production'` and `env.NODE_ENV='production'` for both web and worker.
  - Set `instances: 1` for workers; use cluster mode for web if horizontal scaling is desired.
  - Add `merge_logs: true`, `error_file` and `out_file` paths and `max_memory_restart` where appropriate.

- `Redis`:
  - Use `noeviction` eviction policy for job queues to avoid losing queued jobs.
  - Prefer `rediss://` (TLS) endpoints and confirm correct TLS port with provider.

  Notes:
  - If your provider exposes a plaintext port while you have a `rediss://` URL, verify with `openssl s_client` and `nc` from the deploy host. If the port is plaintext, use `redis://` and include the password in `REDIS_URL`.
  - Managed providers often expose separate ports for TLS vs non-TLS — confirm the port in the provider console.

- `Security`:
  - Do not enable `HUSKY` or install devDependencies on the production host. Use `npm ci --omit=dev`.
  - Ensure `.env.production` has correct, unquoted values and is readable only by the runtime user.

- `PM2` service:
  - Install PM2 globally on the deploy host and run `pm2 startup systemd` to persist on reboot.
  - Use `pm2 save` after `pm2 start` to persist the process list.

**Health & Monitoring**

- Configure log rotation (pm2-logrotate) or external log collection (Filebeat/CloudWatch).
- Add a `metrics` process (already available in repo) or expose Prometheus metrics from the app.

**Quick one-liners**

- Install runtime deps and build (production-safe):

  ```bash
  HUSKY=0 npm ci --omit=dev
  npm run build
  ```

- Start PM2-managed services:

  ```bash
  chmod +x scripts/pm2-start.sh
  sudo scripts/pm2-start.sh
  ```

**Additional Deployment Notes**

- PM2 `--env-file` is not supported in many PM2 versions. Use one of these patterns:
  - Load `.env.production` into the shell (safely) and then `pm2 start` so PM2 inherits the env vars.
    ```bash
    # safe loader - avoids problems with special characters or background tokens
    while IFS= read -r line; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      export "$line"
    done < .env.production

    pm2 start dist/worker/entry.js --name content-engine-worker
    pm2 restart content-engine-worker --update-env
    ```
  - Prefer starting via an `ecosystem` file (recommended) and use `pm2 start ecosystem.pm2.production.cjs --env production`.

- Do NOT `source .env.production` directly if values contain `&` or unescaped shell characters — this can start background jobs or break the shell. Use the safe loader above or `dotenv/config` for ephemeral debug runs only.

- Neon/managed Postgres SNI note: if `psql` fails with an SNI/endpoint error, append the endpoint identifier to the DB URL for the `psql` client, e.g. `?options=endpoint%3D<endpoint-id>` (the endpoint id is typically the first label of the host). This is required for older libpq clients.

- Redis eviction: change the provider's `maxmemory-policy` to `noeviction` for production. If the provider UI disallows changes, contact support.

- Operational checks to run after deploy:
  - `pm2 logs content-engine-worker --lines 200` — confirm no Redis TLS/eviction errors.
  - Verify heartbeats in DB: `SELECT id, status, lastHeartbeatAt FROM "WorkerLifecycle" ORDER BY updatedAt DESC LIMIT 10;`

