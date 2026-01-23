/**
 * FILE OBJECTIVE:
 * - PM2 ecosystem configuration for production deployment of ai-tutor web and worker.
 *
 * LINKED UNIT TEST:
 * - tests/unit/ecosystem.config.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-23T06:30:00Z | copilot-agent | simplified env handling for reliable prod deployment
 */

/**
 * PM2 ecosystem configuration - Production
 *
 * IMPORTANT: Environment variables (DATABASE_URL, REDIS_URL, etc.) must be
 * exported into the shell BEFORE running `pm2 start ecosystem.config.cjs`.
 * 
 * The deploy script (scripts/deploy-and-run.sh) handles this by running:
 *   set -o allexport; source .env.production; set +o allexport
 * 
 * PM2 will then inherit these variables when started with --update-env.
 */

module.exports = {
  apps: [
    {
      // ─────────────────────────────────────────────────────────────────────
      // Web process (Next.js)
      // ─────────────────────────────────────────────────────────────────────
      name: 'ai-tutor-web',
      script: 'npm',
      cwd: __dirname,
      args: 'start',
      interpreter: 'none',  // Don't use node to run npm
      instances: 1,
      exec_mode: 'fork',
      
      // Environment - NODE_ENV is always production; other vars inherited from shell
      env: {
        NODE_ENV: 'production',
        // These will be populated from the shell environment when PM2 starts
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
      },
      
      // Logging
      error_file: 'logs/ai-tutor-web-error.log',
      out_file: 'logs/ai-tutor-web-out.log',
      merge_logs: true,
      time: true,
      
      // Restart policies
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '512M',
      watch: false,
    },
    {
      // ─────────────────────────────────────────────────────────────────────
      // Content-engine worker
      // ─────────────────────────────────────────────────────────────────────
      name: 'content-engine-worker',
      script: 'dist/worker/entry.js',
      cwd: __dirname,
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment - critical vars must be present or worker will fail fast
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
      },
      
      // Logging
      error_file: 'logs/content-engine-worker-error.log',
      out_file: 'logs/content-engine-worker-out.log',
      merge_logs: true,
      time: true,
      
      // Restart policies - worker should restart on crash but not loop forever
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '256M',
      watch: false,
    },
  ],
};
