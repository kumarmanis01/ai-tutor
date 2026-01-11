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
