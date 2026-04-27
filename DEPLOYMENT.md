<!--
FILE OBJECTIVE:
- Provide a concise, actionable Step 1–Step 4 deploy guide for single-VPS PM2 deployment.

LINKED UNIT TEST:
- tests/unit/docs/deployment.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-01-04T00:00:00Z | assistant | updated with Step 1–Step 4 deploy runbook
-->

# DEPLOYMENT — Step 1 to Step 4

This document lists the end-to-end, non-destructive steps you asked for: Step 1 (repo/build prep), Step 2 (staging dry-run), Step 3 (production deploy), Step 4 (CI/hooks/secrets + verification runbook).

## Step 1 — Repo preparation & build configuration

- Objective: limit changes to configuration and dependencies; ensure runtime dependencies for worker imports and PM2 CommonJS config.
- Actions:
	- Add CommonJS PM2 config: `ecosystem.config.cjs` (keeps PM2 from loading ESM ecosystem files in this codebase).
	- Ensure runtime dependency for worker imports:

```bash
npm install --save tsconfig-paths
```

	- Keep business logic unchanged; only update `package.json` scripts and dev/runtime deps as needed.
	- Required build sequence (used by scripts):

```bash
npm ci
npx prisma generate
npm run build:workers
npm run build
```

## Step 2 — Staging dry-run (interactive, non-destructive)

- Objective: an interactive staging run that builds and validates without processing production data.
- Implementation summary:
	- `scripts/vps_staging_run.sh` — interactive script that defaults to `.env.staging` and writes a timestamped log to `tmp/staging_logs/` using restrictive permissions (dir 700, files 600).
	- The script runs the build steps and starts web/worker processes in a dry or debug mode (worker should not claim jobs; use environment flags like `DRY_RUN=1` or `ALLOW_LLM_CALLS=0`).

- Example run:

```bash
./scripts/vps_staging_run.sh
tail -n 200 tmp/staging_logs/staging-<ts>.log
```

- Document staging behaviour in `scripts/README.md` explaining each check and how to abort.

## Step 3 — Production deploy (non-interactive, secure)

- Objective: idempotent non-interactive deploy for `master` with secure fetch/checkout, PM2 reload, and health checks.
- Key characteristics implemented in `scripts/vps_production_deploy.sh`:
	- Per-step helpers: `run_step`, `run_step_allow_fail`, `run_sensitive_step`.
	- Safe logs: `tmp/deploy_logs/` created with `chmod 700`; logs created with `chmod 600`.
	- Primary fetch: SSH `git fetch origin --tags`. HTTPS fallback using `GITHUB_PAT`/`GITHUB_TOKEN`/`GH_TOKEN` executed via a sensitive helper so tokens are not logged.
	- Avoid nested quoting: fetch/checkout done via a temporary on-disk helper script; `REF` (branch/tag) is exported so child script sees it.

- Typical production steps executed by the script:

```bash
# create safe log file
# npm ci
npx prisma generate
npm run build:workers
npm run build
# pm2 reload / restart steps
pm2 reload ecosystem.config.cjs --only ai-tutor-web
pm2 reload ecosystem.config.cjs --only content-engine-worker
# run HTTP/DB/Redis health checks
```

- Sensitive token usage:
	- The script accepts `GITHUB_PAT`, `GITHUB_TOKEN`, or `GH_TOKEN` for HTTPS fallback; these are used only internally by `run_sensitive_step` and not printed.

- Env file handling:
	- Keep `.env.production` on the VPS only and set `chmod 600 /path/to/.env.production`.

- Example invocation & checks after deploy:

```bash
./scripts/vps_production_deploy.sh --ref master
tail -n 400 tmp/deploy_logs/deploy-<ts>.log
pm2 status
pm2 logs ai-tutor-web --lines 200
pm2 logs content-engine-worker --lines 200
```

To persist PM2 across reboots:

```bash
pm2 save
pm2 startup
# run the printed sudo command to enable systemd startup
```

## Step 4 — CI, hooks, secrets handling & verification runbook

- Objective: ensure safety for CI and local hooks, remove secrets from repo, and provide a concise verification checklist.

- Hooks & CI:
	- Keep Husky pre-commit checks but allow bypass using `SKIP_HOOKS=1` or `HUSKY_SKIP_HOOKS=1` for controlled commits.
	- CI (GitHub Actions) should run lint, type-check, and unit tests. Ensure test jobs either run `npx prisma generate` or mock DB access.
	- Maintain linked unit tests for any production code changes.

- Secrets handling:
	- Remove tracked `.env.production` and add to `.gitignore`:

```bash
git rm --cached .env.production
echo ".env.production" >> .gitignore
git commit -m "chore: remove tracked production env" --no-verify
```

	- Store `.env.production` on the VPS and restrict permissions:

```bash
chmod 600 /home/gnosiva/apps/content-engine/ai-tutor/.env.production
```

	- Rotate any tokens/keys that may have been exposed historically.
	- Prefer an SSH Deploy Key (read-only) for VPS repo access. Example (on VPS):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_deploy_ai_tutor -C "deploy@ai-tutor" -N ""
cat ~/.ssh/id_deploy_ai_tutor.pub  # add as GitHub Deploy Key (read-only)
git remote set-url origin git@github.com:OWNER/REPO.git
```

- Verification runbook (post-deploy checks):

1. PM2 status and process detail:

```bash
pm2 status
pm2 describe ai-tutor-web
pm2 describe content-engine-worker
```

2. Tail logs:

```bash
pm2 logs ai-tutor-web --lines 200
pm2 logs content-engine-worker --lines 200
tail -n 400 tmp/deploy_logs/deploy-<ts>.log
```

3. HTTP health check:

```bash
curl -I https://your.domain/health || curl -I http://127.0.0.1:3000/health
```

4. DB / Redis smoke tests:
	- Run a lightweight script that uses `DATABASE_URL` and `REDIS_URL` to perform a ping/query.

5. Confirm PM2 persistence:

```bash
pm2 save
# verify systemd service exists after `pm2 startup`, optionally test reboot if safe
```

6. Verify secrets permissions:

```bash
ls -l /home/gnosiva/apps/content-engine/ai-tutor/.env.production
# expect -rw------- (600)
```

## Handoff & documentation

- Add this file as `DEPLOYMENT.md` at repo root (updated). Add `scripts/README.md` with usage for both staging and production scripts and instructions for skipping pre-commit hooks.
- Recommended next steps:
	- Register a read-only Deploy Key on GitHub for the VPS and update `origin` to SSH.
	- Rotate tokens that may have been committed previously.
	- Run the verification checklist after the next deploy and paste any failing logs for diagnosis.

---

## Detailed operations

### 1) How to run the scripts and accepted parameters

- Ensure the script is executable on the VPS and you run as the deploy user (example: `gnosiva`):

```bash
chmod +x scripts/vps_production_deploy.sh
chmod +x scripts/vps_staging_run.sh
```

- Production script usage (supported args / env):

```bash
# Basic (default ref is master if not provided)
./scripts/vps_production_deploy.sh --ref master

# Optional flags / env:
# --ref <branch|tag|commit>   : the Git ref to deploy (default: master)
# --log-dir <path>           : override log directory (default: tmp/deploy_logs)
# --no-build                 : skip build steps (useful for debugging)
# ENV variables used by the script:
#   GITHUB_PAT|GITHUB_TOKEN|GH_TOKEN : used only for HTTPS fallback (kept secret)
#   SKIP_HOOKS=1 or HUSKY_SKIP_HOOKS=1 : bypass local pre-commit hooks when committing
#   VERBOSE=1                  : enable more verbose logging in the script (if implemented)
```

- Staging script usage (interactive dry-run):

```bash
./scripts/vps_staging_run.sh
# It reads .env.staging by default; pass a different env file by setting ENV_FILE
ENV_FILE=.env.staging ./scripts/vps_staging_run.sh
```

- Notes:
	- Always run the script from the repository root (the scripts expect relative paths).
	- Prefer an SSH Deploy Key for `git` access from the VPS. If SSH is not available the script will attempt HTTPS+PAT fallback using `GITHUB_PAT` (kept secret and used only in-memory by a sensitive helper).

### 2) Post-setup steps (one-time / after first deploy)

- Ensure `.env.production` exists and is permission-restricted:

```bash
chown gnosiva:gnosiva /home/gnosiva/apps/content-engine/ai-tutor/.env.production
chmod 600 /home/gnosiva/apps/content-engine/ai-tutor/.env.production
```

- Persist PM2 across reboots (run as the deploy user, follow the printed sudo command):

```bash
pm2 save
pm2 startup
# follow the printed command, then run:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u gnosiva --hp /home/gnosiva
```

- Setup log rotation for PM2 logs (example using logrotate):

Create `/etc/logrotate.d/ai-tutor` with content that rotates PM2 logs and keeps limited history. Use `logrotate` policy consistent with your ops standards.

- Backup & maintenance:
	- Add a periodic backup of the DB (managed externally) and of uploads/static assets if any.
	- Schedule `npm audit` and weekly dependency updates in a safe staging environment before promoting to production.

- Security hardening:
	- Verify firewall rules allow only required ports (80/443, SSH from admin IPs).
	- Rotate tokens/keys and revoke any leaked credentials.
	- Store secrets in a secrets manager if available (e.g., Vault). For small setups, restrict `.env.production` carefully.

### 3) PM2 management (commands and recommended practices)

- Start/stop/update using the ecosystem file:

```bash
# Start all processes defined in the CommonJS ecosystem file
pm2 start ecosystem.config.cjs

# Restart or reload a named process
pm2 restart ai-tutor-web
pm2 reload ai-tutor-web    # reload is zero-downtime when supported by the app

# Stop and delete
pm2 stop content-engine-worker
pm2 delete content-engine-worker

# Show status and details
pm2 list
pm2 status
pm2 describe ai-tutor-web
```

- Logs and troubleshooting:

```bash
pm2 logs ai-tutor-web --lines 200
pm2 logs content-engine-worker --lines 200
pm2 flush   # clear logs
pm2 reloadLogs
```

- Persistence and startup:

```bash
pm2 save        # saves current process list for resurrect
pm2 startup     # prints the system command to run as root to enable startup
```

- Recommended practices:
	- Use `pm2 reload` for web processes that support graceful reload (preserves connections).
	- Use `pm2 restart` for worker processes when code changes require a full restart.
	- Keep small log file retention via `logrotate` and use `pm2 flush` occasionally.

### 4) Web and Worker validation steps (detailed)

Below are repeatable checks to validate that the deployed web and worker processes are healthy.

- A. Quick PM2 checks

```bash
pm2 status
pm2 describe ai-tutor-web
pm2 describe content-engine-worker
```

Verify both processes are `online` and the restart counts are reasonable (not constantly increasing).

- B. Web validation

1) Basic HTTP health endpoints

```bash
curl -fSsf -I https://your.domain/health || curl -fSsf -I http://127.0.0.1:3000/health
```

Expect `200 OK` and a short JSON body or header that indicates healthy.

2) Smoke test a page or SSR path

```bash
curl -fSsf https://your.domain/ | head -n 40
```

Confirm HTML renders and static assets are 200. If using TLS, verify certificate and chain.

3) Next.js build/time-of-deploy checks

```bash
grep -E "Compiled successfully|Error" .next/* -R || tail -n 200 tmp/deploy_logs/deploy-<ts>.log
```

4) Authentication callback sanity

Test the `NEXTAUTH_URL` callback flow in a browser or using a curl sequence if you have a test account; verify redirect URIs.

- C. Worker validation

1) Verify worker process is running and not crashing

```bash
pm2 status content-engine-worker
pm2 logs content-engine-worker --lines 200
```

2) Redis connectivity

If `redis-cli` is available, run:

```bash
redis-cli -u "$REDIS_URL" PING
# expect: PONG
```

Alternatively, run a small Node check from the repo root:

```bash
node -e "(async()=>{const IORedis=require('ioredis');const r=new IORedis(process.env.REDIS_URL||process.env.REDIS);
try{console.log('PING',await r.ping());}catch(e){console.error(e);process.exit(2);}finally{r.disconnect();}})()"
```

3) DB connectivity (quick check)

If `psql` is available or you have a safe read-only query, run it; otherwise use a Node/Prisma one-liner:

```bash
node -e "(async()=>{const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();try{await p.$connect();console.log('DB OK');}catch(e){console.error(e);process.exit(2);}finally{await p.$disconnect();}})()"
```

4) Enqueue a test job and observe worker processing

If your repo includes a lightweight test producer (recommended), run it to enqueue a short-lived job and watch `pm2 logs` to confirm processing.

Example pattern:

```bash
# from repo: enqueue
node scripts/enqueue_test_job.js
# then watch worker logs
pm2 logs content-engine-worker --lines 200
```

If no test producer exists, create a short ad-hoc script that pushes a known message to the queue and verify the worker handles it.

5) LLM / external API gating

Verify the worker respects runtime feature gates: `ALLOW_LLM_CALLS` should be `0` in staging/dry-run and `1` in production where allowed. Check environment values in `pm2 describe` output.

---

If you'd like I can commit this updated `DEPLOYMENT.md` for you and push it to the current branch. Proceed to commit?
