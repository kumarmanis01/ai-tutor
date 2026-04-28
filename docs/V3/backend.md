# Spinzy Academy — Backend & Infrastructure User Stories

> **Implementation status last updated: 2026-04-27**
> Legend: ✅ Complete | ⚠️ Partial | ❌ Not started | 🔄 N/A (equivalent exists)

---

## B1.1 | P0 | Core Prisma Schema — All Models & Migrations

**ID:** B1.1
**Labels:** P0, phase:database-foundation
**Phase:** Database Foundation
**Status: ✅ Complete**

### User Story

As a backend developer, I want a complete, normalized Prisma schema with all models, enums, relations, and indexes so that every feature team can work against a single source of truth for the database.

### Acceptance Criteria

- [x] All models defined with correct types, relations, and constraints
- [x] User & Profile models: User with all fields. `ProfileRole` → `UserRole` (existing), `ConsentStatus` → `ConsentReqStatus` (existing), `ProfileStatus` → `AccountStatus` (existing), `Board`/`SubscriptionStatus`/`SubscriptionPlan`/`StartingLevel` implemented as typed String fields with plans.ts
- [x] Content models: `Content`, `ContentVersion`, `ContentFlag` — all present. Enums: `ContentType`, `ContentStatus`, `FlagReason`, `FlagStatus` — all present
- [x] Consent models: `ConsentRequest`, `ConsentMessageLog` — present. Enums: `ConsentChannel`, `ConsentReqStatus`, `MessageStatus` — all present
- [x] Learning & Progress models: `StreakHistory` added (2026-04-27). Equivalent models cover remaining: `StudentTopicProgress` (LearningProgress), `AttemptQuestion` (PracticeAttempt), `DiagnosticSession` (DiagnosticResult), `StudentXP` (XPTransaction), `HomeworkAssignment` (StudentAssignment). Enums: `XPReason` added (2026-04-27)
- [x] Subscription & Payment models: `PaymentMethod`, `Invoice`, `Referral` — present. `Notification` added (2026-04-27). `SupportTicket` added (2026-04-27). Enums: `PaymentType`, `PaymentStatus`, `ReferralStatus`, `TicketStatus`, `TicketPriority` — all added (2026-04-27)
- [x] Admin models: `AdminUser`, `AdminTrustedDevice`, `AdminAuditLog` — present. Enums: `AdminRole`, `AdminStatus` — present
- [x] Generation & Queue models: `GenerationJob` — present. Enum: `ContentGenerationJobStatus` (covers `JobStatus`)
- [x] School & Lead models: `SchoolPartner`, `SchoolLead` — present. Enum: `LeadStatus` — present
- [x] All @@unique and @@index constraints created
- [x] Foreign key relations cascade or restrict as appropriate
- [ ] Initial migration run on production Neon (pending `prisma migrate dev --name v3-support-ticket-notification-streak-history`)
- [ ] Migration reversible — verify with `prisma migrate dev` up/down cycle

### Dev Tasks

- [x] All models in `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name v3-support-ticket-notification-streak-history` to apply the 3 new models
- [ ] Verify tables created: `SupportTicket`, `Notification`, `StreakHistory`
- [ ] Seed script update if needed

### QA

- [ ] `prisma generate` produces correct TypeScript types for new models
- [ ] `SupportTicket`, `Notification`, `StreakHistory` tables present in Neon after migration
- [ ] Unique constraints enforced at DB level

---

## B1.2 | P0 | Database Connection Pooling & Redis Setup

**ID:** B1.2
**Labels:** P0, phase:database-foundation
**Phase:** Database Foundation
**Status: ✅ Complete**

### User Story

As a backend developer, I want Prisma connection pooling with PgBouncer and a Redis instance for caching/sessions/queues so that the database handles concurrent connections without exhaustion under load.

### Acceptance Criteria

- [x] PostgreSQL 15+ running (Docker: `pgvector/pgvector:pg15`)
- [x] PgBouncer configured for transaction-level pooling (`POOL_MODE: transaction`)
- [x] Prisma datasource `directUrl = env("DIRECT_DATABASE_URL")` — migrations bypass PgBouncer
- [x] Connection pool: Min 5 (`MIN_POOL_SIZE`), Max 20 (`DEFAULT_POOL_SIZE`)
- [x] Connection timeout: 10 seconds (`SERVER_CONNECT_TIMEOUT: 10`)
- [x] Redis 7+ running (`redis:7-alpine`)
- [x] Redis client configured in `lib/redis.ts` with retry/backoff, TLS support
- [x] Redis used for: JWT blacklist, rate limiting, consent dedup tokens, WhatsApp counters, BullMQ queues, content-gen partials
- [x] Env vars: `DATABASE_URL` (→ PgBouncer with `?pgbouncer=true&connection_limit=20`), `DIRECT_DATABASE_URL` (→ Postgres direct), `REDIS_URL`
- [ ] Production VPS: add `DIRECT_DATABASE_URL` to ecosystem.config.cjs and `.env.production`

### Dev Tasks

- [x] `docker-compose.yml` — PgBouncer service added (`edoburu/pgbouncer:1.22.1`)
- [x] Web/worker/scheduler services updated to use PgBouncer port 6432
- [x] Prisma datasource updated with `directUrl`
- [x] Redis client wrapper (`lib/redis.ts`) with exponential backoff retry

### QA

- [ ] `docker compose up` starts all 5 services (postgres, pgbouncer, redis, web, worker)
- [ ] 100 concurrent Prisma queries do not exhaust pool
- [ ] Redis responds within 1ms on localhost

---

## B2.1 | P0 | JWT-Based Authentication Service

**ID:** B2.1
**Labels:** P0, phase:auth
**Phase:** Authentication & Authorization
**Status: ✅ Complete**

### Acceptance Criteria

- [x] `lib/auth/token.service.ts` — `generateAccessToken`, `generateRefreshToken`, `verifyToken` (+ typed variants per scope)
- [x] `TokenPayload` interface: `sub`, `role`, `scope`, `jti`, `iat`, `exp`
- [x] On logout: `blacklist:token:{jti}` stored in Redis with TTL = remaining token lifetime (`lib/auth/blacklist.service.ts`)
- [x] Middleware checks blacklist before accepting token (`lib/socket/server.ts`, API middleware)
- [x] Refresh token rotation: old refresh token blacklisted before issuing new pair (`app/api/v1/auth/refresh/route.ts`)
- [x] Separate secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_ACCESS_SECRET`, `ADMIN_JWT_REFRESH_SECRET`
- [x] All secrets loaded from env vars — never hardcoded

### QA

- [ ] Valid token → accepted. Expired token → 401
- [ ] Blacklisted token (post-logout) → 401
- [ ] Refresh rotation: old refresh token rejected after rotation

---

## B2.2 | P0 | Google OAuth Integration Service

**ID:** B2.2
**Labels:** P0, phase:auth
**Phase:** Authentication & Authorization
**Status: ✅ Complete**

### Acceptance Criteria

- [x] `verifyGoogleToken(idToken)` — validates via `google-auth-library`, verifies `aud` matches `GOOGLE_CLIENT_ID`, returns `{ googleId, email, name, picture? }`
- [x] `findOrCreateUser(payload)` — searches by `googleId` then `email`, updates name if changed, creates new `User` if not found
- [x] Returns JWT token pair via B2.1
- [x] `POST /api/v1/auth/google` — accepts `{ idToken }`, returns `{ accessToken, refreshToken, isNewUser }`
- [x] Rate limit: 10 requests/IP/minute via Redis incr

### QA

- [ ] Valid Google token → tokens returned
- [ ] New user → `isNewUser: true`
- [ ] Returning user → `isNewUser: false`, existing account
- [ ] Invalid token → 401
- [ ] 11th request in 60s → 429

---

## B2.3 | P1 | MFA (TOTP) Service for Admin

**ID:** B2.3
**Status: ✅ Complete** (pre-existing — `AdminUser.mfaSecret`, `mfaEnabled`, `mfaBackupCodes`, `AdminTrustedDevice` model all present)

---

## B2.4 | P1 | RBAC Middleware for Admin API

**ID:** B2.4
**Status: ✅ Complete** (pre-existing — `AdminRole` enum, role-based guards in admin API routes)

---

## B3.1 | P0 | WhatsApp Cloud API Integration

**ID:** B3.1
**Labels:** P0, phase:communication
**Phase:** Communication Services
**Status: ✅ Complete**

### Acceptance Criteria

- [x] `sendConsentRequest(phone, childName, grade, board, consentToken)` — Cloud API v18.0, pre-approved template `spinzy_consent_request`, 2 retries with exponential backoff (1s, 2s), returns `{ messageId, status }`
- [x] `sendOTP(phone, otp)` — template `spinzy_otp`
- [x] `sendConfirmation(phone, childName, dashboardLink)` — template `spinzy_consent_confirmation`
- [x] `POST /api/v1/webhooks/whatsapp` — HMAC-SHA256 signature validation (`x-hub-signature-256`), YES/haan/ji/ok pattern → consent approval, NO/nahi pattern → consent denial, updates `ConsentMessageLog` (delivered/read/failed), responds 200 OK always
- [x] `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in env
- [x] Templates pre-approved (must be done in Meta Business Manager before production)

### QA

- [ ] Test send to real WhatsApp number
- [ ] "YES" reply → `ConsentRequest.status = APPROVED`, socket event fired
- [ ] "nahi" reply → `ConsentRequest.status = DENIED`
- [ ] Forged HMAC → rejected silently (200 returned, no processing)

---

## B3.2 | P0 | Email Service

**ID:** B3.2
**Labels:** P0, phase:communication
**Phase:** Communication Services
**Status: ✅ Complete**

### Acceptance Criteria

- [x] `sendEmail(opts)` — provider-agnostic, configured via `EMAIL_PROVIDER` env var
- [x] `sendOTP(email, otp)` — renders `OTPEmail` React template
- [x] `sendConsentRequest(email, parentName, childName, grade, consentLink)` — renders `ConsentRequestEmail`
- [x] `sendWeeklyReport(email, reportData)` — renders `WeeklyReportEmail`
- [x] `sendAdminInvite(email, setupLink, role)` — renders `AdminInviteEmail`
- [x] `sendPaymentInvoice(email, invoiceData)` — renders `InvoiceEmail`
- [x] React Email templates in `lib/email/templates/`: `OTPEmail`, `ConsentRequestEmail`, `WeeklyReportEmail`, `AdminInviteEmail`, `InvoiceEmail`
- [x] Rendered using `@react-email/render` — produces HTML + plain text
- [x] `EMAIL_PROVIDER` (`resend` default | `ses`), `FROM_EMAIL`, `FROM_NAME` in env
- [x] **Active provider: Resend** (`RESEND_API_KEY`) — no SMTP config required
- [x] `EMAIL_PROVIDER=ses` → Hostinger/SES SMTP via `AWS_SES_SMTP_HOST/PORT/USER/PASS` (available as fallback, not required)

### QA

- [ ] All 5 templates render without errors (`@react-email/render`)
- [ ] Emails delivered via Resend within 60 seconds
- [ ] Plain text fallback auto-generated in every send

---

## B3.3 | P1 | Push Notification Service (FCM)

**ID:** B3.3
**Status: ⚠️ Partial** — `PushSubscriptionRecord` model exists (Web Push), FCM integration not yet implemented

---

## B4.1 | P0 | AI Content Generation Worker

**ID:** B4.1
**Labels:** P0, phase:ai-pipeline
**Phase:** AI Content Generation Pipeline
**Status: ✅ Complete**

### Acceptance Criteria

- [x] Listens to `content-generation` BullMQ queue
- [x] Receives `{ jobId, topic, subject, grade, board }`
- [x] Calls OpenAI (gpt-4o-mini) with streaming; Anthropic claude-haiku-4-5 as failover
- [x] Prompt: Socratic style, curriculum-aware, English/Hindi language toggle
- [x] Streaming response stored to Redis: `content_gen:{jobId}:partial` every 5 chunks
- [x] Redis pub/sub channel `content_gen:{jobId}:updates` for SSE clients
- [x] On complete: `Content` record created (`status: PENDING_REVIEW`, `type: AI_GENERATED`)
- [x] `GenerationJob.status` → `COMPLETED` with `contentId`
- [x] Subscribers notified via Socket.IO `content_generated` event
- [x] On failure: 3 retries, exponential backoff. Final failure → `status: FAILED` + error message
- [x] Concurrency: 3 jobs. Rate limit: 10/min. Timeout: 120s

### QA

- [ ] End-to-end: POST generation/request → SSE stream → `content_generated` socket event
- [ ] Retry on OpenAI timeout
- [ ] `GenerationJob.status = FAILED` on final failure

---

## B4.2 | P0 | Duplicate Generation Request Merging

**ID:** B4.2
**Labels:** P0, phase:ai-pipeline
**Phase:** AI Content Generation Pipeline
**Status: ✅ Complete**

### Acceptance Criteria

- [x] `normalizeTopic(topic)` — lowercase, remove special chars, spaces → hyphens
- [x] Check Redis: `content_gen:dedup:{normalized_topic}` before creating job
- [x] If exists: atomic subscriber append (`$executeRaw` array_append), return existing `jobId`, `isDuplicate: true`
- [x] If not: create `GenerationJob`, set Redis key (15-min TTL) only after enqueue succeeds
- [x] All subscribers notified via Socket.IO on completion
- [ ] Admin dashboard subscriber count view (post-launch backlog)

### QA

- [ ] Two requests for same topic within 1 min → 1 job, 2 subscribers
- [ ] Both students receive `content_generated` event on completion

---

## B4.3 | P1 | Content Streaming via SSE

**ID:** B4.3
**Status: ✅ Complete** (pre-existing — `GET /api/v1/content/generation/status`, Redis pub/sub partials published by worker)

---

## B5.1 | P0 | WebSocket Server with Socket.IO

**ID:** B5.1
**Labels:** P0, phase:realtime
**Phase:** Real-Time Communication
**Status: ✅ Complete**

### Acceptance Criteria

- [x] Socket.IO server attached to Next.js HTTP server (`/api/socket` path)
- [x] JWT auth middleware on connection — disconnects on invalid/blacklisted token
- [x] Rooms: `user:{userId}` (auto-joined, all scopes), `student:{userId}` (auto-joined for `scope=user`), `consent:{consentToken}` (joined via `join_consent_room` event)
- [x] `consent_approved` → `consent:{token}` room
- [x] `consent_denied` → `consent:{token}` room
- [x] `consent_expired` → `consent:{token}` room
- [x] `premium_activated` → `student:{id}` room with `{ plan, expiresAt }`
- [x] `assignment_received` → `student:{id}` room with `{ assignmentId, title, dueDate?, subject? }`
- [x] `assignment_completed` → `user:{parentId}` room with `{ assignmentId, childName, score? }`
- [x] `content_generated` → `student:{id}` room with `{ contentId, topic }`
- [x] `new_badge` → `user:{userId}` room with `{ badgeId, badgeName, badgeIcon }`

**Fix applied 2026-04-27:** Student room was not auto-joined; students were missing `content_generated` / `premium_activated` / `assignment_received` events. Fixed by auto-joining `rooms.student(userId)` for all `scope=user` connections.

### QA

- [ ] Student connects → joins both `user:{id}` and `student:{id}` rooms
- [ ] `content_generated` event delivered to student after job completes
- [ ] Invalid JWT → socket disconnected
- [ ] Events scoped correctly (parent does not receive student-specific events)

---

## B5.2 | P1 | Event Bus (Internal Pub/Sub)

**ID:** B5.2
**Status: ✅ Complete** (pre-existing — Outbox + OutboxDeadLetter models, transactional outbox pattern via `worker/outboxDispatcher.ts`)

---

## Environment Variables Reference (v3 MVP)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Points to PgBouncer (`?pgbouncer=true&connection_limit=20`) |
| `DIRECT_DATABASE_URL` | ✅ | — | Points to Postgres directly (for `prisma migrate`) |
| `REDIS_URL` | ✅ | — | `redis://host:6379` |
| `JWT_ACCESS_SECRET` | ✅ | — | |
| `JWT_REFRESH_SECRET` | ✅ | — | |
| `ADMIN_JWT_ACCESS_SECRET` | ✅ | — | |
| `ADMIN_JWT_REFRESH_SECRET` | ✅ | — | |
| `GOOGLE_CLIENT_ID` | ✅ | — | |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | — | |
| `WHATSAPP_ACCESS_TOKEN` | ✅ | — | |
| `WHATSAPP_APP_SECRET` | ✅ | — | HMAC webhook validation |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ✅ | — | |
| `EMAIL_PROVIDER` | — | `resend` | `resend` or `ses` |
| `RESEND_API_KEY` | ✅ (if resend) | — | Not needed if `EMAIL_PROVIDER=ses` |
| `FROM_EMAIL` | — | `no-reply@send.spinzyacademy.com` | |
| `FROM_NAME` | — | `Spinzy Academy` | |
| `EMAIL_FROM` | — | — | Full override (e.g. `Spinzy <addr>`) |
| `AWS_SES_SMTP_HOST` | ✅ (if ses) | — | e.g. Hostinger SMTP host |
| `AWS_SES_SMTP_PORT` | — | `587` | |
| `AWS_SES_SMTP_USER` | ✅ (if ses) | — | |
| `AWS_SES_SMTP_PASS` | ✅ (if ses) | — | |
| `OPENAI_API_KEY` | ✅ | — | Content generation |
| `NEXT_PUBLIC_APP_URL` | ✅ | — | |

