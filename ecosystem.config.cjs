/**
 * PM2 ecosystem configuration - Production
 *
 * Purpose: supervise the web process (Next.js production server) and the
 * content-engine worker. Keep configuration conservative for production:
 * - use `npm start` (Next.js `next start`) for the web process so the standard
 *   build/start lifecycle is preserved and environment bootstrapping is
 *   consistent with developer expectations.
 * - keep worker process pointed at the compiled worker entry in `dist/worker`.
 *
 * Notes on key options (documented inline for maintainers):
 * - `script` / `args`: what PM2 runs. We prefer `npm start` for web so Next.js
 *    start semantics are used. Workers run compiled JS directly.
 * - `exec_mode`: `fork` keeps a single OS process under PM2; `cluster` lets PM2
 *    spawn multiple OS workers. Use `cluster` only when the app is explicitly
 *    designed for multi-process operation and you understand session/caching
 *    implications.
 * - `instances`: number of instances to run; `'max'` starts one per CPU core.
 * - `env_file`: path to environment file loaded by PM2 before starting process.
 * - `error_file` / `out_file`: dedicated log files for stderr/stdout to simplify
 *    debugging and log rotation.
 */
module.exports = {
  apps: [
    {
      // Web process (Next.js)
      // Rationale: use `npm start` so PM2 invokes the same entry (`next start`)
      // that developers expect in production. We use `fork` with a single
      // instance to keep behavior predictable; change to `cluster` + `max`
      // only after addressing sticky sessions, in-process caches, and
      // ensuring the app is safe for multiple OS processes.
      name: 'ai-tutor-web',
      script: 'npm',
      cwd: __dirname,
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      // WARNING: Do NOT store secrets (DATABASE_URL, REDIS_URL, API keys)
      // in this file. Keep secrets in `.env.production` on the server or a
      // secrets manager and use `env_file` or runtime injection.
      // Dedicated log files for the web process
      error_file: 'logs/ai-tutor-web-error.log',
      out_file: 'logs/ai-tutor-web-out.log',
      merge_logs: true,
      time: true,
      // Health and restart policies
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 5000,
      max_memory_restart: '512M',
      watch: false
    },
    {
      // Content-engine worker
      // Use a small bash wrapper which sources `.env.production` and then
      // execs the compiled worker. This avoids relying on PM2's `env_file`
      // behaviour which may vary across installations.
      name: 'content-engine-worker',
      script: 'scripts/run-worker.sh',
      cwd: __dirname,
      interpreter: '/bin/bash',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 5000,
      max_memory_restart: '256M',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      // Worker should also have dedicated logs for easier debugging/monitoring
      error_file: 'logs/content-engine-worker-error.log',
      out_file: 'logs/content-engine-worker-out.log'
    }
  ]
};
