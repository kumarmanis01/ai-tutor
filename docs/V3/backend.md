# Spinzy Academy — Backend & Infrastructure User Stories

---

## B1.1 | P0 | Core Prisma Schema — All Models & Migrations

**ID:** B1.1
**Labels:** P0, phase:database-foundation
**Phase:** Database Foundation

### User Story

As a backend developer, I want a complete, normalized Prisma schema with all models, enums, relations, and indexes so that every feature team can work against a single source of truth for the database.

### Acceptance Criteria

- [ ] All models defined with correct types, relations, and constraints
- [ ] User & Profile models: User, Profile with all fields, enums (ProfileRole, ConsentStatus, ProfileStatus, StartingLevel, Board, SubscriptionStatus, SubscriptionPlan)
- [ ] Content models: Content, ContentVersion, ContentFlag with all fields, enums (ContentType, ContentStatus, Difficulty, FlagReason, FlagStatus, Subject)
- [ ] Consent models: ConsentRequest, ConsentMessageLog with all fields, enums (ConsentChannel, ConsentReqStatus, MessageStatus)
- [ ] Learning & Progress models: LearningProgress, PracticeAttempt, DiagnosticResult, XPTransaction, StreakHistory, StudentAssignment with all fields, enums (ProgressStatus, XPReason)
- [ ] Subscription & Payment models: PaymentMethod, Invoice, Referral, Notification, SupportTicket with all fields, enums (PaymentType, PaymentStatus, ReferralStatus, TicketStatus, TicketPriority)
- [ ] Admin models: AdminUser, AdminTrustedDevice, AdminAuditLog with all fields, enums (AdminRole, AdminStatus)
- [ ] Generation & Queue models: GenerationJob with all fields, enums (JobStatus)
- [ ] School & Lead models: SchoolPartner, SchoolLead with all fields, enums (LeadStatus)
- [ ] Initial migration generates without errors
- [ ] All @@unique and @@index constraints created
- [ ] Foreign key relations cascade or restrict as appropriate
- [ ] Migration is reversible (prisma migrate dev works up and down)

### Dev Tasks

- [ ] Create all models in packages/prisma-schema/schema.prisma
- [ ] Run prisma migrate dev --name initial_schema
- [ ] Verify database tables created in PostgreSQL
- [ ] Seed script for development: prisma/seed.ts with test data

### QA

- [ ] prisma generate produces correct TypeScript types
- [ ] All relations queryable (test via prisma studio)
- [ ] Unique constraints enforced at DB level
- [ ] Indexes created on frequently queried fields

---

## B1.2 | P0 | Database Connection Pooling & Redis Setup

**ID:** B1.2
**Labels:** P0, phase:database-foundation
**Phase:** Database Foundation

### User Story

As a backend developer, I want Prisma connection pooling with PgBouncer and a Redis instance for caching/sessions/queues so that the database handles concurrent connections without exhaustion under load.

### Acceptance Criteria

- [ ] PostgreSQL 15+ running (locally via Docker, production via AWS RDS or similar)
- [ ] PgBouncer configured for transaction-level pooling
- [ ] Prisma datasource configured with pgbouncer=true in connection string
- [ ] Connection pool: Min 5, Max 20 connections
- [ ] Connection timeout: 10 seconds
- [ ] Redis 7+ running (locally via Docker, production via AWS ElastiCache or Upstash)
- [ ] Connection configured in apps/api/src/lib/redis.ts
- [ ] Redis used for: Session storage (JWT blacklist/refresh tokens), Rate limiting counters, Consent token temporary storage, WhatsApp usage counters, Queue (BullMQ), Analytics cache
- [ ] Environment variables: DATABASE_URL, DIRECT_DATABASE_URL, REDIS_URL

### Dev Tasks

- [ ] docker-compose.yml with PostgreSQL, PgBouncer, Redis services
- [ ] Prisma schema: relationMode = "prisma" (required for PgBouncer)
- [ ] Redis client wrapper with connection retry logic

### QA

- [ ] 100 concurrent connections do not exhaust pool
- [ ] Redis responds within 1ms on localhost
- [ ] Docker Compose: docker compose up starts all services

---

## B2.1 | P0 | JWT-Based Authentication Service

**ID:** B2.1
**Labels:** P0, phase:auth
**Phase:** Authentication & Authorization

### User Story

As a backend developer, I want a centralized JWT authentication service with access tokens, refresh tokens, and token blacklisting so that all API routes can validate user/admin identity consistently.

### Acceptance Criteria

- [ ] Token Service (packages/shared/src/auth/token.service.ts) with generateAccessToken, generateRefreshToken, verifyToken methods
- [ ] TokenPayload interface with sub, role, scope, iat, exp fields
- [ ] On logout: blacklist:token:{jti} stored in Redis with TTL = remaining token lifetime
- [ ] Middleware checks blacklist before accepting token
- [ ] Refresh token rotation: Old refresh token blacklisted when new one issued
- [ ] Separate secrets for JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ADMIN_JWT_ACCESS_SECRET, ADMIN_JWT_REFRESH_SECRET
- [ ] All secrets loaded from environment variables. Never hardcoded.

### Dev Tasks

- [ ] Create token service in packages/shared/src/auth/
- [ ] Create auth middleware for Express: authenticateUser, authenticateAdmin
- [ ] Create token blacklist service using Redis
- [ ] Unit tests for: token generation, verification, expiry, blacklisting

### QA

- [ ] Valid token → accepted. Expired token → 401
- [ ] Blacklisted token → 401
- [ ] Refresh token rotation: old refresh token invalid after rotation
- [ ] Different secrets for admin vs user tokens (admin token rejected on user routes)

---

## B2.2 | P0 | Google OAuth Integration Service

**ID:** B2.2
**Labels:** P0, phase:auth
**Phase:** Authentication & Authorization

### User Story

As a backend developer, I want a Google OAuth service that validates ID tokens and creates/links user accounts so that parents can sign up and log in with one tap.

### Acceptance Criteria

- [ ] verifyGoogleToken(idToken) validates token using google-auth-library, verifies aud matches Google Client ID, returns { googleId, email, name, picture? }
- [ ] findOrCreateUser(payload) searches by googleId then email, updates name if changed, returns user, creates new User record if not found
- [ ] Returns JWT token pair via B2.1
- [ ] API Endpoint POST /api/v1/auth/google accepts { idToken: string }, returns { accessToken, refreshToken, isNewUser: boolean }
- [ ] Rate limit: 10 requests per IP per minute

### Dev Tasks

- [ ] Install google-auth-library
- [ ] Create Google auth service
- [ ] Create API route and controller
- [ ] Configure Google Cloud Console: OAuth 2.0 Client ID (Web + Android)

### QA

- [ ] Valid Google ID token → Returns tokens + user
- [ ] New Google user → isNewUser: true. Account created
- [ ] Returning Google user → isNewUser: false. Existing account returned
- [ ] Invalid/expired token → 401
- [ ] Rate limiting works

---

## B2.3 | P1 | MFA (TOTP) Service for Admin

**ID:** B2.3
**Labels:** P1, phase:auth
**Phase:** Authentication & Authorization

### User Story

As a backend developer, I want a TOTP-based MFA service for admin accounts using speakeasy so that admin logins are protected by a second factor.

### Acceptance Criteria

- [ ] generateSecret() uses speakeasy.generateSecret, returns { secret, otpauth_url, qr_code_data_url }
- [ ] verifyTOTP(secret, token) uses speakeasy.totp.verify with window: 1 (±30 seconds tolerance)
- [ ] generateBackupCodes(count = 10) generates random 8-character hex codes, returns plain text codes (shown once)
- [ ] hashBackupCodes(codes) hashes each code with bcrypt, stored as JSON array in AdminUser.mfaBackupCodes
- [ ] verifyBackupCode(adminId, code) compares against stored hashed codes, on match removes that code (one-time use)

### Dev Tasks

- [ ] Install speakeasy and qrcode
- [ ] Create MFA service
- [ ] Unit tests for: secret generation, TOTP verification (valid, invalid, expired), backup code generation and verification

### QA

- [ ] TOTP code within ±30s → valid
- [ ] TOTP code outside window → invalid
- [ ] Backup code works once. Removed after use

---

## B2.4 | P1 | RBAC Middleware for Admin API

**ID:** B2.4
**Labels:** P1, phase:auth
**Phase:** Authentication & Authorization

### User Story

As a backend developer, I want a role-based access control middleware that checks permissions per route so that Content Admins cannot access billing, Support Admins cannot delete content.

### Acceptance Criteria

- [ ] requirePermission(permission: AdminPermission) Express middleware reads admin.role from decoded JWT, looks up permissions from shared ROLE_PERMISSIONS map, returns 403 if permission missing with { error: 'INSUFFICIENT_PERMISSIONS' }
- [ ] Permission Map (packages/shared/src/permissions/admin-permissions.ts) exports ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]>
- [ ] Exported hasPermission(role, permission) boolean function

### Dev Tasks

- [ ] Create permission enum and map in shared package
- [ ] Create RBAC middleware
- [ ] Unit tests: Each role → correct permissions
- [ ] Integration test: Content Admin calls revenue endpoint → 403

### QA

- [ ] Unauthorized role → 403
- [ ] Authorized role → passes through
- [ ] Missing JWT → 401

---

## B3.1 | P0 | WhatsApp Cloud API Integration

**ID:** B3.1
**Labels:** P0, phase:communication
**Phase:** Communication Services

### User Story

As a backend developer, I want a WhatsApp Cloud API service that sends consent requests and processes replies via webhook so that parents can approve their child's access via WhatsApp.

### Acceptance Criteria

- [ ] sendConsentRequest(phone, childName, grade, board, consentToken) uses WhatsApp Cloud API v18.0+, sends pre-approved message template with template variables, returns { messageId, status }, retry on failure 2 retries with exponential backoff
- [ ] sendOTP(phone, otp) sends 6-digit OTP via WhatsApp template
- [ ] sendConfirmation(phone, childName, dashboardLink) sends approval confirmation
- [ ] Webhook POST /api/v1/webhooks/whatsapp validates webhook signature (x-hub-signature-256), parses incoming message, if reply matches /\bYES\b/i triggers consent approval, if reply matches /\bNO\b|\bnahi\b/i triggers consent denial, updates ConsentMessageLog with delivery/read status, responds with 200 OK
- [ ] WhatsApp Business Account ID, Phone Number ID, Access Token in env vars
- [ ] Webhook verify token configured
- [ ] Message templates pre-approved in Meta Business Manager

### Dev Tasks

- [ ] Create WhatsApp service class
- [ ] Create webhook route and handler
- [ ] Register webhook URL in Meta Developer Console
- [ ] Create and submit message templates for approval
- [ ] Unit tests: Mock WhatsApp API responses

### QA

- [ ] Consent message sends and delivers to real WhatsApp number (test)
- [ ] "YES" reply triggers callback
- [ ] Webhook signature validation rejects forged requests
- [ ] Retry logic works on API failure
- [ ] Message status updates correctly (sent → delivered → read)

---

## B3.2 | P0 | Email Service

**ID:** B3.2
**Labels:** P0, phase:communication
**Phase:** Communication Services

### User Story

As a backend developer, I want a transactional email service using React Email templates and AWS SES or SendGrid so that the platform can send OTPs, consent requests, weekly reports, and admin invites.

### Acceptance Criteria

- [ ] sendEmail(options: { to, subject, html, text }) uses AWS SES or SendGrid, provider configurable via environment variable
- [ ] sendOTP(email, otp) method
- [ ] sendConsentRequest(email, childName, consentLink) method
- [ ] sendWeeklyReport(email, reportData) method
- [ ] sendAdminInvite(email, setupLink, role) method
- [ ] sendPaymentInvoice(email, invoiceUrl) method
- [ ] React Email templates for all transactional emails in packages/email-templates/: OTPEmail, ConsentRequestEmail, WeeklyReportEmail, AdminInviteEmail, InvoiceEmail
- [ ] Rendered using @react-email/render to HTML + plain text
- [ ] EMAIL_PROVIDER, AWS_REGION, SENDGRID_API_KEY, FROM_EMAIL, FROM_NAME in env

### Dev Tasks

- [ ] Create email service with provider abstraction
- [ ] Create all React Email templates
- [ ] Create template rendering utility
- [ ] Unit tests: Template rendering, email sending (mock provider)

### QA

- [ ] All templates render without errors
- [ ] HTML emails render correctly in Gmail, Outlook, Apple Mail
- [ ] Plain text fallback auto-generated
- [ ] Emails delivered within 60 seconds

---

## B3.3 | P1 | Push Notification Service (FCM)

**ID:** B3.3
**Labels:** P1, phase:communication
**Phase:** Communication Services

### User Story

As a backend developer, I want a Firebase Cloud Messaging service for sending push notifications to parents and students so that real-time alerts work for consent approval, premium requests, and assignment completions.

### Acceptance Criteria

- [ ] sendPush(userId, title, body, data?) looks up user's registered device tokens, sends via FCM HTTP v1 API, handles invalid/expired tokens (removes from DB)
- [ ] registerDevice(userId, token, platform) stores FCM token with user ID
- [ ] unregisterDevice(token) removes token
- [ ] DeviceToken model with id, userId, token, platform, createdAt and unique constraint on token

### Dev Tasks

- [ ] Set up Firebase project. Download service account key
- [ ] Install firebase-admin
- [ ] Create push notification service
- [ ] API: POST /api/v1/notifications/register-device
- [ ] API: DELETE /api/v1/notifications/unregister-device

### QA

- [ ] Push notification delivers to Android device
- [ ] Invalid token removed automatically
- [ ] Multiple devices per user supported

---

## B4.1 | P0 | AI Content Generation Worker

**ID:** B4.1
**Labels:** P0, phase:ai-pipeline
**Phase:** AI Content Generation Pipeline

### User Story

As a backend developer, I want a BullMQ worker that processes content generation jobs from the queue, calls the AI API, and stores results so that student-requested content is generated asynchronously without blocking the API.

### Acceptance Criteria

- [ ] Listens to content-generation queue (BullMQ)
- [ ] Receives { jobId, topic, subject, grade, board }
- [ ] Calls AI service (OpenAI / Anthropic / open-source LLM)
- [ ] Prompt includes: Topic, subject, grade, board, language (English/Hindi), curriculum context, Socratic teaching style
- [ ] Receives streaming response
- [ ] Stores partial result in Redis: content_gen:{jobId}:partial (for SSE streaming to student)
- [ ] On complete: Creates Content record with status: PENDING_REVIEW, contentType: AI_GENERATED
- [ ] Updates GenerationJob status to COMPLETED
- [ ] Notifies subscribers (students) via WebSocket
- [ ] On failure: Retries up to 3 times with exponential backoff. On final failure: Updates job status to FAILED with error message
- [ ] Duplicate check: Before processing, checks if a COMPLETED or PROCESSING job exists for same normalized topic
- [ ] BullMQ queue with Redis connection, concurrency 3 jobs, rate limit max 10 jobs per minute, job timeout 120 seconds

### Dev Tasks

- [ ] Set up BullMQ with Redis
- [ ] Create ContentGenerationWorker
- [ ] Create AIService (abstraction over LLM provider)
- [ ] Create prompt templates for different subjects/grades
- [ ] Implement partial result storage for SSE
- [ ] Unit tests: Mock AI API

### QA

- [ ] Job processes successfully within 60 seconds
- [ ] Partial result available within 10 seconds (for SSE)
- [ ] Retry on failure. Max 3 retries
- [ ] Failed job logged with error
- [ ] Concurrency limit respected
- [ ] AI output is valid Markdown

---

## B4.2 | P0 | Duplicate Generation Request Merging

**ID:** B4.2
**Labels:** P0, phase:ai-pipeline
**Phase:** AI Content Generation Pipeline

### User Story

As a backend developer, I want duplicate generation requests for the same topic within 15 minutes to be merged so that we don't waste AI API credits on redundant work.

### Acceptance Criteria

- [ ] Before creating a new GenerationJob: Normalize topic (lowercase, remove special chars, replace spaces with hyphens)
- [ ] Check Redis: EXISTS content_gen:dedup:{normalized_topic}
- [ ] If exists: Get jobId from Redis. Add current student to subscriberIds of existing job. Return existing jobId
- [ ] If not exists: Create new job. Set Redis key with 15-minute TTL
- [ ] When job completes: All subscribers receive completion notification via WebSocket
- [ ] Admin dashboard shows subscriber count per generation job

### Dev Tasks

- [ ] Create deduplication service
- [ ] Integrate into generation request flow (Student Journey S3.2)
- [ ] Unit tests: Duplicate within 15 min → merged. New after 15 min → new job

### QA

- [ ] Two students request same topic within 1 minute → 1 job created, 2 subscribers
- [ ] Student requests same topic after 16 minutes → New job created
- [ ] Both students receive content when generated

---

## B4.3 | P1 | Content Streaming via Server-Sent Events (SSE)

**ID:** B4.3
**Labels:** P1, phase:ai-pipeline
**Phase:** AI Content Generation Pipeline

### User Story

As a backend developer, I want an SSE endpoint that streams AI-generated content to the student as it's being generated so that the student sees content within 15 seconds instead of waiting for full generation.

### Acceptance Criteria

- [ ] Endpoint GET /api/v1/content/generation/{jobId}/stream is authenticated, student owns the job or is a subscriber
- [ ] Sets headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
- [ ] On connection: Sends any already-generated partial content from Redis
- [ ] Listens to Redis pub/sub channel content_gen:{jobId}:updates
- [ ] Sends events: partial with { content, progress }, complete with { contentId, fullContent }, error with { message }
- [ ] Timeout: 120 seconds. Sends timeout event if generation takes longer
- [ ] Student client handles: partial → renders incrementally, complete → replaces with final content, error → shows fallback message, timeout → shows "We'll notify you when ready"

### Dev Tasks

- [ ] Create SSE endpoint
- [ ] Redis pub/sub for partial updates
- [ ] Client-side EventSource handling (in Student app)
- [ ] Unit tests: SSE events format

### QA

- [ ] Partial content arrives within 10 seconds
- [ ] Complete event fires on generation finish
- [ ] Error event fires on failure
- [ ] Client reconnects on connection drop

---

## B5.1 | P0 | WebSocket Server with Socket.IO

**ID:** B5.1
**Labels:** P0, phase:realtime
**Phase:** Real-Time Communication

### User Story

As a backend developer, I want a Socket.IO server that handles real-time events (consent approval, premium activation, assignment notifications) so that the student and parent apps update instantly without polling.

### Acceptance Criteria

- [ ] Socket.IO server attached to HTTP server
- [ ] Authentication: Validates JWT on connection. Disconnects if invalid
- [ ] Rooms: user:{userId} (personal), student:{profileId} (student), consent:{consentToken} (consent status)
- [ ] Event consent_approved to consent:{token} room with {} payload triggered by parent approval
- [ ] Event consent_denied to consent:{token} room with {} payload triggered by parent denial
- [ ] Event consent_expired to consent:{token} room with {} payload triggered by token expiry
- [ ] Event premium_activated to student:{id} room with { plan } payload triggered by payment
- [ ] Event assignment_received to student:{id} room with { assignment } payload triggered by parent assignment
- [ ] Event assignment_completed to user:{parentId} room with { childName, score } payload triggered by student completion
- [ ] Event content_generated to student:{id} room with { contentId, topic } payload triggered by AI completion
- [ ] Event new_badge to student:{id} room with { badge } payload triggered by achievement

### Dev Tasks

- [ ] Install and configure Socket.IO
- [ ] Create JWT authentication middleware for WebSocket
- [ ] Create event emitter service (EventBus) used by backend services
- [ ] Create client-side useSocket hook

### QA

- [ ] Authenticated client connects and joins personal room
- [ ] Invalid JWT → disconnected
- [ ] Events delivered to correct room
- [ ] Events not delivered to wrong room
- [ ] Reconnection works after network drop

---

## B5.2 | P1 | Event Bus (Internal Pub/Sub)

**ID:** B5.2
**Labels:** P1, phase:realtime
**Phase:** Real-Time Communication

### User Story

As a backend developer, I want an internal event bus that decouples services and allows async communication so that services like consent, payment, and content generation can trigger notifications without direct dependencies.

### Acceptance Criteria

- [ ] Typed event emitter using Node.js EventEmitter or Redis pub/sub (for multi-instance)
- [ ] Event types: CONSENT_APPROVED, CONSENT_DENIED, CONSENT_EXPIRED, PAYMENT_SUCCEEDED, PAYMENT_FAILED, CONTENT_GENERATED, ASSIGNMENT_CREATED, ASSIGNMENT_COMPLETED and more
- [ ] Subscribers: NotificationSubscriber sends push notifications + creates in-app notifications, WebSocketSubscriber emits events to relevant Socket.IO rooms, EmailSubscriber sends emails for non-urgent events, AuditLogSubscriber logs all events to audit trail

### Dev Tasks

- [ ] Create typed event bus
- [ ] Create subscriber classes
- [ ] Register subscribers at app startup
- [ ] Use Redis pub/sub if multi-instance deployment

### QA

- [ ] Event emitted → All subscribers receive
- [ ] Subscriber failure does not crash emitter
- [ ] Events are typed (wrong payload → TypeScript error)

---

## B6.1 | P1 | Razorpay Integration — Orders & Subscriptions

**ID:** B6.1
**Labels:** P1, phase:payments
**Phase:** Payment Integration

### User Story

As a backend developer, I want Razorpay integration for creating orders, processing payments, and managing subscriptions via webhooks so that parents can pay via UPI and cards seamlessly.

### Acceptance Criteria

- [ ] createOrder(amount, currency, receipt) uses razorpay.orders.create, returns { id, amount, currency }
- [ ] verifyPaymentSignature(orderId, paymentId, signature) uses razorpay.utils.verifyPaymentSignature
- [ ] createSubscription(planId, customerId) for recurring billing
- [ ] Webhook POST /api/v1/webhooks/razorpay validates webhook signature (x-razorpay-signature)
- [ ] Handles payment.captured event: Activate premium, Create invoice, Emit PAYMENT_SUCCEEDED
- [ ] Handles payment.failed event: Emit PAYMENT_FAILED, Log for recovery
- [ ] Handles subscription.charged event: Extend subscription, Create invoice
- [ ] Handles subscription.cancelled event: Mark subscription expired
- [ ] Handles refund.created event: Process refund
- [ ] RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET in env

### Dev Tasks

- [ ] Install razorpay SDK
- [ ] Create Razorpay service
- [ ] Create webhook handler
- [ ] Unit tests: Mock Razorpay API

### QA

- [ ] Order creation works
- [ ] Payment signature verification works
- [ ] Webhook updates subscription correctly
- [ ] Invalid signature → 401

---

## B6.2 | P2 | Invoice PDF Generation

**ID:** B6.2
**Labels:** P2, phase:payments
**Phase:** Payment Integration

### User Story

As a backend developer, I want automatic PDF invoice generation and email delivery on successful payments so that parents have a record for tax and expense tracking.

### Acceptance Criteria

- [ ] On payment.captured webhook: Generate invoice PDF
- [ ] PDF includes: Spinzy logo, Invoice number, Date, Parent name, Plan, Amount (₹), GST (if applicable), Payment method, Payment ID
- [ ] PDF stored in S3/DigitalOcean Spaces. URL saved to Invoice.pdfUrl
- [ ] Emailed to parent

### Dev Tasks

- [ ] Use @react-pdf/renderer or pdfkit for PDF generation
- [ ] Create invoice template
- [ ] S3 upload service

### QA

- [ ] PDF generated within 30 seconds of payment
- [ ] PDF includes all required fields
- [ ] Invoice emailed

---

## B7.1 | P1 | Rate Limiting Middleware

**ID:** B7.1
**Labels:** P1, phase:security
**Phase:** Rate Limiting & Security

### User Story

As a backend developer, I want rate limiting on all public and authenticated API routes using Redis so that the platform is protected from abuse and brute-force attacks.

### Acceptance Criteria

- [ ] Uses express-rate-limit with Redis store (rate-limit-redis)
- [ ] Default: 100 requests per 15 minutes per IP for authenticated routes
- [ ] Strict limits for sensitive routes: /api/v1/auth/_ 10 requests per 15 minutes per IP, /api/v1/consent/_ 5 requests per 15 minutes per IP, /api/v1/students/register 3 requests per 24 hours per device fingerprint
- [ ] Response on limit exceeded: 429 { error: 'TOO_MANY_REQUESTS', retryAfter: 900 }
- [ ] Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

### Dev Tasks

- [ ] Install express-rate-limit and rate-limit-redis
- [ ] Create rate limit config for different route groups
- [ ] Apply middleware to route groups

### QA

- [ ] Rate limit enforced. 101st request → 429
- [ ] Headers present
- [ ] Redis store works (limits persist across app restarts)

---

## B7.2 | P1 | Input Validation Middleware (Zod)

**Labels:** P1, phase:security
**Phase:** Rate Limiting & Security

### User Story

As a backend developer, I want request body, query, and params validation using Zod on all API routes so that invalid data is rejected early with clear error messages.

### Acceptance Criteria

- [ ] validate(schema, source = 'body') Express middleware validates request data against Zod schema
- [ ] On success: req.validated = parsedData. Passes to handler
- [ ] On failure: 400 { error: 'VALIDATION_ERROR', details: [{ field, message }] }
- [ ] All request schemas in apps/api/src/validators/ organized by domain: auth.validator.ts, student.validator.ts, content.validator.ts, etc.

### Dev Tasks

- [ ] Create validation middleware
- [ ] Create Zod schemas for all endpoints
- [ ] Apply to all routes

### QA

- [ ] Invalid body → 400 with field-level errors
- [ ] Valid body → passes through
- [ ] Hindi-safe error messages (no English jargon)

---

## B7.3 | P1 | Security Headers & CORS Configuration

**Labels:** P1, phase:security
**Phase:** Rate Limiting & Security

### User Story

As a backend developer, I want security headers (Helmet) and strict CORS configuration on all API servers so that the platform follows security best practices.

### Acceptance Criteria

- [ ] helmet middleware applied with secure defaults
- [ ] CORS configured: Only allow https://spinzyacademy.com, https://admin.spinzyacademy.com, and http://localhost:3000 (dev)
- [ ] Content-Security-Policy header set
- [ ] Rate limit headers exposed
- [ ] X-Powered-By hidden

### QA

- [ ] Security headers present in response
- [ ] CORS blocks unauthorized origins
- [ ] Preflight requests handled

---

## B8.1 | P1 | BullMQ Queue Infrastructure

**Labels:** P1, phase:jobs-cron
**Phase:** Background Jobs & Cron

### User Story

As a backend developer, I want BullMQ queues and workers set up with Redis for async task processing so that content generation, email sending, and report generation don't block API responses.

### Acceptance Criteria

- [ ] Queues: content-generation (AI content generation), email (non-blocking sending), whatsapp (message sending), notifications (push sending), reports (weekly/monthly generation)
- [ ] Each queue has a dedicated worker file in apps/api/src/workers/
- [ ] Workers run in a separate process (for production) or same process (for development)
- [ ] Graceful shutdown: Workers complete current job before exit
- [ ] Bull Board at /admin/queues (protected by admin auth)

### Dev Tasks

- [ ] Install bullmq
- [ ] Create queue definitions
- [ ] Create worker files
- [ ] Set up Bull Board
- [ ] Docker Compose: Worker service

### QA

- [ ] Jobs enqueued and processed
- [ ] Failed jobs visible in Bull Board
- [ ] Retry works

---

## B8.2 | P1 | Cron Jobs for Periodic Tasks

**Labels:** P1, phase:jobs-cron
**Phase:** Background Jobs & Cron

### User Story

As a backend developer, I want cron jobs for periodic tasks like weekly reports, streak resets, and token cleanup so that these run reliably on schedule without manual intervention.

### Acceptance Criteria

- [ ] weekly-report job runs every Sunday 18:00 IST generating and sending weekly parent reports
- [ ] monthly-report job runs 1st of every month 09:00 IST generating monthly premium reports
- [ ] streak-reset job runs every day 00:05 IST resetting streaks for inactive students (48h threshold)
- [ ] consent-token-cleanup job runs every hour marking expired consent tokens as EXPIRED
- [ ] content-expiry job runs every day 03:00 IST archiving expired content
- [ ] whatsapp-usage-reset job runs 1st of every month 00:01 IST resetting WhatsApp monthly counter
- [ ] BullMQ repeat option for each job
- [ ] IST timezone handling (dayjs with timezone plugin)
- [ ] Job locking: Prevent duplicate execution if previous run still in progress

### Dev Tasks

- [ ] Define repeatable jobs
- [ ] Implement job handlers
- [ ] Timezone configuration

### QA

- [ ] Weekly report job fires Sunday 18:00 IST
- [ ] Streak reset correctly identifies 48h inactive students
- [ ] Token cleanup marks expired tokens
- [ ] Jobs don't overlap

---

## B8.3 | P2 | Admin Job Dashboard (Bull Board)

**Labels:** P2, phase:jobs-cron
**Phase:** Background Jobs & Cron

### User Story

As a Super Admin, I want a visual dashboard to monitor BullMQ queues, failed jobs, and job metrics so that I can diagnose issues without SSH access.

### Acceptance Criteria

- [ ] Bull Board at admin.spinzy.academy/queues (auth-protected, Super Admin only)
- [ ] Shows: All queues, Job counts (waiting, active, completed, failed), Job details (payload, logs, attempts)
- [ ] Actions: Retry failed job, Remove job, Clean queue

### QA

- [ ] Dashboard loads
- [ ] Real-time job status updates
- [ ] Retry/remove actions work

```

```
