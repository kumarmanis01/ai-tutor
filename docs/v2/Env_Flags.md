<!--
FILE OBJECTIVE:
- Catalog all environment variables referenced in the codebase and document
  a concise purpose for each variable (when known).

LINKED UNIT TEST:
- tests/unit/docs/env_flags.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-21T00:00:00Z | copilot | created
-->

# Environment Flags (env -> purpose)

This document lists environment variables referenced in the repository and
provides a short description of their purpose when known. Only variables
referenced in application source files (not Next.js internals) are included.

**Core infrastructure**
- DATABASE_URL: Postgres connection string used by Prisma/DB access.
- REDIS_URL: Redis connection string used by queues, caching and rate limiters.
- REDIS_USE_TLS: Enable TLS for Redis (when using rediss:// or explicit toggle).
- REDIS_TLS_SERVERNAME: TLS servername for Redis connections.
- REDIS_TLS_REJECT_UNAUTHORIZED: Set to '0' to skip Redis TLS cert validation.

**Authentication / app URL**
- NEXTAUTH_SECRET: Secret used by NextAuth for signing/encryption.
- NEXTAUTH_URL: Public base URL used for auth callbacks and link generation.
- NEXTAUTH_URL_INTERNAL: Internal auth base URL variant used server-side.
- AUTH_TRUST_HOST: (app-specific) trust-host config for auth flows.
- VERCEL: Presence flag when running on Vercel (used in some auth logic).
- NEXT_PUBLIC_BASE_URL: Client-visible base URL for building client links.
- NEXT_PUBLIC_APP_URL: Client app URL used in emails/links.
- APP_URL: Server-side fallback app URL.

**Feature flags & rollout**
- ENABLE_AI_TUTOR: Toggle AI tutor feature on/off.
- ENABLE_DISTRESS_DETECTION: Toggle distress-detection features.
- ENABLE_TUTOR_CARD: Toggle tutor card UI/behavior.
- NEXT_PUBLIC_CONSENT_LIVE: Client-facing toggle for consent live mode.
- NEXT_PUBLIC_ENABLE_LITE_PLAN: Client toggle to expose lite plan on pricing.
- ROLLOUT_PERCENTAGE: Percent rollout for experimental features.
- ENABLE_RECOMMENDATION_TRACE: Toggle recommendation tracing (internal).
- ENABLE_SESSION_ENGINE: Toggle alternate session engine behavior.

**Payments (Razorpay / billing)**
- RAZORPAY_KEY_ID: Razorpay API key (private) used server-side.
- RAZORPAY_KEY_SECRET: Razorpay API secret (private) used server-side.
- RAZORPAY_WEBHOOK_SECRET: Secret used to verify Razorpay webhooks.
- NEXT_PUBLIC_RAZORPAY_KEY_ID: Client-facing Razorpay key id for checkout.
- RAZORPAY_PLAN_* / RAZORPAY_PLAN_STANDARD_MONTHLY / RAZORPAY_PLAN_FAMILY_*: Plan IDs used to map product SKUs.
- RAZORPAY_FAMILY_MONTHLY_PLAN_ID / RAZORPAY_FAMILY_ANNUAL_PLAN_ID: billing plan ids.

**Email / Notification providers**
- RESEND_API_KEY: API key for Resend (email provider).
- EMAIL_FROM: Default `From` address used for outbound email.
- SUPPORT_EMAIL: Fallback support email used in templates.
- ONCALL_EMAIL: On-call contact for alerts and reports.

**SMS / WhatsApp**
- MSG91_AUTH_KEY: auth key for MSG91 SMS service.
- MSG91_TEMPLATE_ID: default MSG91 template id for SMS messages.
- MSG91_WIDGET_TOKEN: token for MSG91 widget integrations.
- WHATSAPP_API_URL: WhatsApp API base URL (default Graph API).
- WHATSAPP_API_TOKEN: WhatsApp API bearer token.
- WHATSAPP_PHONE_ID: WhatsApp phone id used to send messages.
- WHATSAPP_ENABLED: Feature flag (1 = enabled) for WhatsApp flows.
- WHATSAPP_WEBHOOK_VERIFY_TOKEN: Verify token for incoming WhatsApp webhooks.

**Storage (S3 / Cloud R2 / S3 presign)**
- S3_BUCKET: S3 bucket name for AWS uploads (server-side).
- NEXT_PUBLIC_S3_BUCKET: Client-visible bucket name (if exposed).
- S3_PRESIGN_EXPIRES: Default expires (seconds) for S3 presigned URLs.
- NEXT_PUBLIC_S3_PRESIGN_EXPIRES: Client-side fallback presign expiry.
- AWS_REGION / AWS_DEFAULT_REGION: AWS region used for services.
- AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN: AWS credentials.
- R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_REGION / R2_BUCKET / R2_PUBLIC_URL: Cloudflare R2 credentials & endpoints.

**LLM / AI / embeddings**
- OPENAI_API_KEY: OpenAI API key for embeddings and completions.
- ANTHROPIC_API_KEY: Anthropic API key (failover provider).
- MODEL_SMALL / MODEL_MEDIUM / MODEL_LARGE / MODEL_DEFAULT: Model name overrides used by the callLLM logic.
- OPENAI_MODEL: (alias) model name used in some endpoints.
- LLM_MODE: 'real' | 'mock' etc. to select LLM behaviour in runtime.
- LLM_SAFE_MODE: Toggle to enforce safe-mode behavior for LLMs.
- ALLOW_LLM_CALLS: Gate that must be '1' to permit outgoing LLM calls in some workers.
- ALLOW_PERSIST_RAW_AI_OUTPUT: Allow raw AI outputs to be persisted (audit).
- AI_CONTENT_DEBUG / HYDRATION_DEBUG: debug toggles for AI content / hydration flows.
- LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY: When true, only console-log raw LLM output.
- LLM_CALL_TIMEOUT_MS: default timeout for LLM HTTP calls.
- LLM_RETRY_MAX_ATTEMPTS / LLM_RETRY_BASE_DELAY_MS: retry behaviour for LLM calls.
- LLM_BATCH_CONCURRENCY: concurrency for LLM batch operations.
- RAG_CONTEXT_CHAR_LIMIT / MAX_PROMPT_LENGTH: prompt/context limits used by RAG and prompt building.

**Validation / tuning caps**
- VALIDATION_CAP_CHAPTERS: cap used by validators for chapter counts.
- VALIDATION_CAP_QUESTIONS_PER_DIFFICULTY: cap for question validation per difficulty.
- VALIDATION_CAP_TOPICS_PER_CHAPTER: cap for topics per chapter validation.
- QUESTIONS_LLM_TIMEOUT_MS / SYLLABUS_LLM_TIMEOUT_MS / NOTES_LLM_TIMEOUT_MS: LLM timeouts per worker type.

**Debug / test helpers**
- NODE_ENV: Node environment ('development'|'production'|'test').
- NEXT_PUBLIC_DEBUG_MODE: client-side debug toggle.
- WORKER_DEBUG: worker-level debug override.
- LOG_LEVEL: server log level override.
- JEST_WORKER_ID: presence used by code to detect test runner.
- RUN_ONCE: scripts/workers run-once toggle.
- SAMPLE_INTERVAL_SEC, WATCHDOG_INTERVAL_SEC: scheduling intervals used by scripts.
- QA_EMAIL: QA email used for testing utilities.

**OTP / security**
- OTP_SECRET: Secret used to sign/verify OTP codes.
- OTP_EXPIRY_SECONDS: expiry window for OTP codes.

**Alerts / observability / exec settings**
- SLACK_WEBHOOK: Slack webhook URL used by alerting scripts.
- SLACK_CHANNEL / SLACK_USERNAME: optional slack sink settings.
- PAGER_WEBHOOK: Pager/webhook for alert sinks.
- OPS_EMAIL: ops email for alert sinks.
- ALERT_RL_CAPACITY / ALERT_RL_WINDOW / ALERT_DEDUPE_TTL / ALERT_RL_REFILL: rate-limiter & dedupe settings for alerting.
- SHUTDOWN_TIMEOUT_MS: graceful shutdown timeout for scripts.

**Queues / runtime heuristics**
- QUEUE_BACKLOG_THRESHOLD: threshold for queue backlog alerts.
- QUEUE_AGE_THRESHOLD: age threshold for queue jobs to trigger alerts.
- FAILED_SPIKE_MULT / FAILED_SPIKE_MIN: heuristics for failure spike detection.
- JOB_DRY_RUN: run jobs in dry-run mode when set to '1'.

**Invoices / tax**
- PLATFORM_GST_RATE: GST rate applied to invoices (decimal, e.g. 0.18).
- PLATFORM_HSN: HSN code used on invoices.
- PLATFORM_GSTIN: GSTIN for platform invoices.

**Misc / convenience**
- SUPPORT_EMAIL: support contact used in templates.
- ADMIN_PURGE_SECRET: admin endpoint secret used for purge operations.
- SUBSCRIPTION_RENEWAL_SIMULATE_FAILURES: testing toggle to simulate failures.
- QA_EMAIL: email used for QA/test flows.

If you want this file to include internal Next.js or build-time envs (e.g. __NEXT_PREVIEW_MODE_ID,
__NEXT_BUILD_ID, __NEXT_*), or a machine-readable CSV/JSON export, tell me and I will add that.
