# Deployment README (Production)

This file contains concise, copy-pasteable steps to deploy the ai-tutor app and worker on an AlmaLinux VPS with PM2.

Prerequisites
- A non-root user with sudo privileges
- Git access to the repository (or a tarball) checked out on the VPS
- PostgreSQL and Redis endpoints accessible from the VPS

Quick deploy steps

1. Install OS packages & Node 20 (NodeSource):

```bash
sudo dnf install -y gcc-c++ make python3 git
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

2. From repo root: install only production deps and build

```bash
# skip dev deps and husky
HUSKY=0 npm ci --omit=dev --prefer-offline --no-audit --progress=false
npm run build
```

3. Ensure `.env.production` is present, unquoted values, and permissions 600

```bash
cp .env.production /etc/ai-tutor.env  # optional central location
chmod 600 .env.production
```

4. Start PM2-managed services (uses `ecosystem.pm2.production.cjs` if present):

```bash
chmod +x scripts/pm2-start.sh
sudo scripts/pm2-start.sh
```

5. Verify status and logs

```bash
pm2 status
pm2 logs content-engine-worker --lines 200
pm2 logs ai-tutor-web --lines 200
```

Redis TLS note
- If your Redis provider requires TLS, ensure `REDIS_URL` in `.env.production` uses the provider's TLS host:port with `rediss://`.
- If TLS fails and you must temporarily use plaintext inside a trusted VPC, convert `rediss://` to `redis://` in the env. Restore TLS for production.

Redis eviction policy
- Set eviction policy to `noeviction` for job reliability.

Rollback
- To stop services: `pm2 stop ecosystem.pm2.production.cjs` or `pm2 stop content-engine-worker`.
- To restart after code changes: `HUSKY=0 npm ci --omit=dev && npm run build && pm2 restart ecosystem.pm2.production.cjs --update-env`

Security
- Never commit `.env.production` to git.
- Keep `.env.production` readable only by the runtime user.

"One-liner" to build + start (example; careful with sudo and environment):

```bash
cd /path/to/ai-tutor && HUSKY=0 npm ci --omit=dev && npm run build && sudo scripts/pm2-start.sh
```

If you need a systemd unit instead of PM2, let me know and I can provide a unit file that execs PM2 or node directly.
