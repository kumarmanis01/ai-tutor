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
        // EMAIL_FROM must use verified Resend sending domain
        // Correct: "Spinzy Academy <no-reply@send.spinzyacademy.com>"
        // Wrong:   "Spinzy Academy <no-reply@spinzyacademy.com>"
        // Verified domain in Resend: send.spinzyacademy.com
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
        // EMAIL_FROM must use verified Resend sending domain
        // Correct: "Spinzy Academy <no-reply@send.spinzyacademy.com>"
        // Wrong:   "Spinzy Academy <no-reply@spinzyacademy.com>"
        // Verified domain in Resend: send.spinzyacademy.com
        EMAIL_FROM: process.env.EMAIL_FROM,
        ONCALL_EMAIL: process.env.ONCALL_EMAIL,
        ENABLE_AI_TUTOR: process.env.ENABLE_AI_TUTOR ?? 'false',
        ENABLE_DISTRESS_DETECTION: process.env.ENABLE_DISTRESS_DETECTION ?? 'false',
        ENABLE_TUTOR_CARD: process.env.ENABLE_TUTOR_CARD ?? 'false',
        ENABLE_SESSION_ENGINE: process.env.ENABLE_SESSION_ENGINE ?? 'false',
        ROLLOUT_PERCENTAGE: process.env.ROLLOUT_PERCENTAGE ?? '5',
        LLM_MODE: process.env.LLM_MODE ?? 'real',
        LLM_SAFE_MODE: process.env.LLM_SAFE_MODE ?? 'true',
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
        // EMAIL_FROM must use verified Resend sending domain
        // Correct: "Spinzy Academy <no-reply@send.spinzyacademy.com>"
        // Wrong:   "Spinzy Academy <no-reply@spinzyacademy.com>"
        // Verified domain in Resend: send.spinzyacademy.com
        EMAIL_FROM: process.env.EMAIL_FROM,
        ONCALL_EMAIL: process.env.ONCALL_EMAIL,
        ENABLE_AI_TUTOR: process.env.ENABLE_AI_TUTOR ?? 'false',
        ENABLE_DISTRESS_DETECTION: process.env.ENABLE_DISTRESS_DETECTION ?? 'false',
        ENABLE_TUTOR_CARD: process.env.ENABLE_TUTOR_CARD ?? 'false',
        ENABLE_SESSION_ENGINE: process.env.ENABLE_SESSION_ENGINE ?? 'false',
        ROLLOUT_PERCENTAGE: process.env.ROLLOUT_PERCENTAGE ?? '5',
        LLM_MODE: process.env.LLM_MODE ?? 'real',
        LLM_SAFE_MODE: process.env.LLM_SAFE_MODE ?? 'true',
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
