# Worker flags & deploy notes

Purpose: brief reference for worker runtime debug flags and recommended VPS deploy steps.

Flags
- `WORKER_DEBUG` — set to `1` or `true` to force server-side verbose logs. When set:
  - `lib/logger` emits `debug`-level output and `logger.getLogs()`/`subscribe()` return logs.
  - Useful for PM2-run worker processes when you need detailed job lifecycle traces.
- `AI_CONTENT_DEBUG` — enables extra debug output in LLM call paths (input prompts, responses) where implemented.
- `HYDRATION_DEBUG` — enables verbose messages inside hydrators and related producers.

PM2 / ecosystem example
Add these env entries to your PM2 ecosystem (or systemd unit) for worker processes:

```js
module.exports = {
  apps: [
    {
      name: 'worker',
      script: 'dist/worker/bootstrap.js',
      env_production: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://...',
        REDIS_URL: 'redis://...',
        WORKER_DEBUG: '1',           // enable verbose worker logs
        HYDRATION_DEBUG: '1',       // enable hydration debug
        AI_CONTENT_DEBUG: '1',      // enable LLM debug
      }
    }
  ]
}
```

Notes on `npx prisma generate`
- You only need to run `npx prisma generate` on the VPS when one of the following happens:
  - The Prisma schema (`prisma/schema.prisma`) changed.
  - The `@prisma/client` package or its version changed (due to `npm ci` / package install).
  - Node modules were freshly installed on the VPS (e.g., `npm ci` was run).
- If your deploy pipeline performs a fresh `npm ci` (recommended), run `npx prisma generate` as part of the build step so the generated client is available under `node_modules/.prisma` before starting workers.

Recommended minimal deploy steps (VPS)

```bash
# fetch & checkout
git fetch --all && git checkout <branch>

# install production deps
npm ci --production

# generate prisma client (run if node_modules was installed or schema changed)
npx prisma generate

# build compiled JS into dist/
npm run build

# restart workers (PM2) — ensure ecosystem config sets env_production
pm2 restart ecosystem.config.cjs --env production
```

Important runtime constraints
- Workers must run the compiled JS from `dist/` (PM2 must point to `dist/worker/bootstrap.js`).
- Do NOT load `dotenv` in production code; env vars must be injected by PM2 or the process manager.

If you want, I can add a short `deploy` script under `scripts/` that performs these steps and logs the actions.
