# PM2 env_file usage for ai-tutor

Summary
- PM2 does not automatically load project `.env` files for processes.
- We add `env_file: '.env.production'` to `ecosystem.config.js` so PM2 will load that file into the process environment when starting/restarting apps.

What changed
- `ecosystem.config.js`:
  - Added `env_file: '.env.production'` to both `content-engine-worker` and `ai-tutor-web` app configs.

Why this fixes the worker error
- Prisma (and other libs) read `process.env.DATABASE_URL` at runtime. PM2-launched processes only see environment variables that PM2 was started with or those provided via `env`/`env_file` in the ecosystem file. Pointing `env_file` at `.env.production` ensures `DATABASE_URL` and related vars are available.

Deployment steps (server)
1. Ensure `.env.production` exists on the server root of the project and contains secrets (e.g. `DATABASE_URL=...`).
2. Pull the latest repo changes.
3. Restart apps with updated envs:

```bash
cd /path/to/ai-tutor
git pull origin <branch>
pm install --production
pm2 restart ecosystem.config.js --update-env
# or restart specific app and update envs
pm2 restart ai-tutor-web --update-env
pm2 restart content-engine-worker --update-env
pm2 logs content-engine-worker --lines 200
```

Security notes
- Do NOT commit secret values to the repo.
- Keep `.env.production` on the server only and restrict filesystem permissions.
- Alternatively, inject secrets into the systemd unit or environment and reference them in `ecosystem.config.js` via `process.env` rather than storing an env file.

Troubleshooting
- If PM2 still reports missing vars, run `pm2 restart ecosystem.config.js --update-env` after exporting the variable or verifying `.env.production` path.
- To explicitly load a different path in the worker, you can also add `dotenv.config({ path: '.env.production' })` at the top of `worker/loop.ts` and rebuild.

Files touched
- `ecosystem.config.js` (added `env_file` entries)

If you want, I can commit these changes and deploy to the VPS (pull + `pm2 restart --update-env`).