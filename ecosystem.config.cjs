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

// ── PM2 log rotation (run once on VPS after pm2 is installed) ──
// pm2 install pm2-logrotate
// pm2 set pm2-logrotate:max_size 50M
// pm2 set pm2-logrotate:retain 7
// pm2 set pm2-logrotate:compress true
// pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
// pm2 set pm2-logrotate:rotateModule true
// pm2 set pm2-logrotate:workerInterval 3600
// pm2 save

// ── Redis connection budget (read before adding workers) ──
// Each BullMQ Worker holds 2 persistent Redis connections (blocking BRPOP + ops).
// Idle connection count with ENABLE_DISTRESS_DETECTION=false:
//   Worker process : 13 workers x 2 = 26, plus 1 shared singleton  = 27
//   Scheduler      : 1 shared singleton                             =  1
//   Web process    : 1 shared singleton                             =  1
//   Total at idle  :                                                = 29
// Self-hosted Redis (127.0.0.1) has maxclients=500, so there is plenty of headroom.
// Each new Worker added costs 2 connections. Run setup-local-redis.sh for install.

// ── Redis setup (self-hosted on this VPS) ──
// Run once: sudo bash scripts/setup-local-redis.sh
// Then update .env.production: REDIS_URL=redis://default:<password>@127.0.0.1:6379
// Verify: redis-cli -a <password> --no-auth-warning CLIENT LIST | wc -l

module.exports = {
  apps: [
    // ─────────────────────────────────────────────────────────────────────
    // Web process (Next.js)
    // Deploy with: pm2 start ecosystem.config.cjs --env production
    // ─────────────────────────────────────────────────────────────────────
    {
      name: 'ai-tutor-web',
      script: 'npm',
      cwd: __dirname,
      args: 'start',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        // EMAIL_FROM must use the verified Resend sending domain.
        // Example format: "Brand Name <no-reply@verified-domain>"
        EMAIL_FROM: process.env.EMAIL_FROM,
        VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
        VAPID_SUBJECT: process.env.VAPID_SUBJECT,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        NEXT_PUBLIC_CONSENT_LIVE: process.env.NEXT_PUBLIC_CONSENT_LIVE ?? 'false',
        ONCALL_EMAIL: process.env.ONCALL_EMAIL,
        ENABLE_AI_TUTOR: process.env.ENABLE_AI_TUTOR ?? 'false',
        ENABLE_DISTRESS_DETECTION: process.env.ENABLE_DISTRESS_DETECTION ?? 'false',
        ENABLE_TUTOR_CARD: process.env.ENABLE_TUTOR_CARD ?? 'false',
        ENABLE_SESSION_ENGINE: process.env.ENABLE_SESSION_ENGINE ?? 'false',
        ROLLOUT_PERCENTAGE: process.env.ROLLOUT_PERCENTAGE ?? '5',
        LLM_MODE: process.env.LLM_MODE ?? 'real',
        LLM_SAFE_MODE: process.env.LLM_SAFE_MODE ?? 'true',
        ALLOW_LLM_CALLS: '1',
        DB_POOL_SIZE: '5',
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
        SENTRY_DSN: process.env.SENTRY_DSN,
        // Set to 'true' once Hindi content pipeline is verified live
        NEXT_PUBLIC_HINDI_ENABLED: process.env.NEXT_PUBLIC_HINDI_ENABLED,
      },

      error_file: 'logs/pm2/ai-tutor-web-error.log',
      out_file: 'logs/pm2/ai-tutor-web-out.log',
      merge_logs: true,
      time: true,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '512M',
      kill_timeout: 15000,
      watch: false,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Content-engine worker (BullMQ consumer)
    // Uses run-worker.sh wrapper which sources .env.production
    // Deploy with: pm2 start ecosystem.config.cjs --env production
    // ─────────────────────────────────────────────────────────────────────
    {
      name: 'content-engine-worker',
      script: 'scripts/run-worker.sh',
      cwd: __dirname,
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        // EMAIL_FROM must use the verified Resend sending domain.
        // Example format: "Brand Name <no-reply@verified-domain>"
        EMAIL_FROM: process.env.EMAIL_FROM,
        ONCALL_EMAIL: process.env.ONCALL_EMAIL,
        ENABLE_AI_TUTOR: process.env.ENABLE_AI_TUTOR ?? 'false',
        ENABLE_DISTRESS_DETECTION: process.env.ENABLE_DISTRESS_DETECTION ?? 'false',
        ENABLE_TUTOR_CARD: process.env.ENABLE_TUTOR_CARD ?? 'false',
        ENABLE_SESSION_ENGINE: process.env.ENABLE_SESSION_ENGINE ?? 'false',
        ROLLOUT_PERCENTAGE: process.env.ROLLOUT_PERCENTAGE ?? '5',
        LLM_MODE: process.env.LLM_MODE ?? 'real',
        LLM_SAFE_MODE: process.env.LLM_SAFE_MODE ?? 'true',
        ALLOW_LLM_CALLS: '1',
        DB_POOL_SIZE: '3',
        SENTRY_DSN: process.env.SENTRY_DSN,
      },

      error_file: 'logs/pm2/content-engine-worker-error.log',
      out_file: 'logs/pm2/content-engine-worker-out.log',
      merge_logs: true,
      time: true,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '256M',
      kill_timeout: 15000,
      watch: false,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Scheduler (cron jobs + hydration reconciler)
    // Uses run-scheduler.sh wrapper which sources .env.production
    // Deploy with: pm2 start ecosystem.config.cjs --env production
    // ─────────────────────────────────────────────────────────────────────
    {
      name: 'ai-tutor-scheduler',
      script: 'scripts/run-scheduler.sh',
      cwd: __dirname,
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        // EMAIL_FROM must use the verified Resend sending domain.
        // Example format: "Brand Name <no-reply@verified-domain>"
        EMAIL_FROM: process.env.EMAIL_FROM,
        ONCALL_EMAIL: process.env.ONCALL_EMAIL,
        ENABLE_AI_TUTOR: process.env.ENABLE_AI_TUTOR ?? 'false',
        ENABLE_DISTRESS_DETECTION: process.env.ENABLE_DISTRESS_DETECTION ?? 'false',
        ENABLE_TUTOR_CARD: process.env.ENABLE_TUTOR_CARD ?? 'false',
        ENABLE_SESSION_ENGINE: process.env.ENABLE_SESSION_ENGINE ?? 'false',
        ROLLOUT_PERCENTAGE: process.env.ROLLOUT_PERCENTAGE ?? '5',
        LLM_MODE: process.env.LLM_MODE ?? 'real',
        LLM_SAFE_MODE: process.env.LLM_SAFE_MODE ?? 'true',
        DB_POOL_SIZE: '2',
        SENTRY_DSN: process.env.SENTRY_DSN,
      },

      error_file: 'logs/pm2/ai-tutor-scheduler-error.log',
      out_file: 'logs/pm2/ai-tutor-scheduler-out.log',
      merge_logs: true,
      time: true,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '256M',
      kill_timeout: 15000,
      watch: false,
    },
  ],
};
