/**
 * PM2 ecosystem configuration - Production
 *
 * Three processes: web (Next.js), worker (BullMQ), scheduler (cron jobs + reconciler)
 *
 * IMPORTANT: Environment variables (DATABASE_URL, REDIS_URL, etc.) must be
 * exported into the shell BEFORE running `pm2 start ecosystem.config.cjs`.
 *
 * The deploy script (scripts/deploy-and-run.sh) handles this by running:
 *   set -o allexport; source .env.production; set +o allexport
 *
 * PM2 will then inherit these variables when started with --update-env.
 */

// ── Redis production checklist (run on VPS before first deploy) ──
// redis-cli CONFIG SET maxmemory-policy allkeys-lru
// redis-cli CONFIG SET maxmemory 256mb
// redis-cli CONFIG SET save "3600 1 300 100 60 10000"   // persistence
// redis-cli CONFIG SET appendonly yes                    // AOF persistence
// Verify: redis-cli CONFIG GET maxmemory-policy

module.exports = {
  apps: [
    // ─────────────────────────────────────────────────────────────────────
    // Web process (Next.js)
    // ─────────────────────────────────────────────────────────────────────
    {
      name: 'ai-tutor-web',
      script: 'npm',
      cwd: __dirname,
      args: 'start',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        ENABLE_AI_TUTOR: 'false',
        ENABLE_DISTRESS_DETECTION: 'false',
      },

      error_file: 'logs/ai-tutor-web-error.log',
      out_file: 'logs/ai-tutor-web-out.log',
      merge_logs: true,
      time: true,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '512M',
      watch: false,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Content-engine worker (BullMQ consumer)
    // Uses run-worker.sh wrapper which sources .env.production
    // ─────────────────────────────────────────────────────────────────────
    {
      name: 'content-engine-worker',
      script: 'scripts/run-worker.sh',
      cwd: __dirname,
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
      },

      error_file: 'logs/content-engine-worker-error.log',
      out_file: 'logs/content-engine-worker-out.log',
      merge_logs: true,
      time: true,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '256M',
      watch: false,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Scheduler (cron jobs + hydration reconciler)
    // Uses run-scheduler.sh wrapper which sources .env.production
    // ─────────────────────────────────────────────────────────────────────
    {
      name: 'ai-tutor-scheduler',
      script: 'scripts/run-scheduler.sh',
      cwd: __dirname,
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
      },

      error_file: 'logs/ai-tutor-scheduler-error.log',
      out_file: 'logs/ai-tutor-scheduler-out.log',
      merge_logs: true,
      time: true,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '256M',
      watch: false,
    },
  ],
};
