```markdown
📘 PHASE 9 — DELIVERY, CONSUMPTION & MONETIZATION

Phase 9 converts published CoursePackages into a real product learners can consume, pay for, and complete — without mutating content.

1️⃣ Phase 9 Design Document
🎯 Phase 9 Goal

Turn immutable published CoursePackages into:

- A learner experience

- A progress-tracked system

- A monetizable, multi-tenant product

With export formats (PDF / LMS)

🔒 Core Non-Negotiable Guarantees

Phase 9 MUST NOT:

- Modify CoursePackage JSON

- Regenerate AI content

- Bypass approval/publish gates

- Mix author/admin flows with learner flows

Phase 9 ONLY READS from Phase 8.

🧩 Phase 9 High-Level Architecture
CoursePackage (immutable)
        ↓
Read-only Delivery APIs
        ↓
Learner Player UI
        ↓
Progress + Entitlements (new models)
        ↓
Exporters (PDF / LMS)

📦 Phase 9 Sub-Phases
Sub-Phase	Purpose
9.1	Learner content delivery APIs
9.2	Course Player UI
9.3	Progress tracking
9.4	PDF / LMS Exporters
9.5	Multi-tenant monetization
9.6	Access control & safety

```

🔹 PHASE 9.1 — Learner Read APIs (FOUNDATION)
🎯 Outcome

Expose published courses safely for learners.

APIs

List available courses

Fetch full course

Fetch lesson by index

🧠 Copilot Prompt — Phase 9.1
Create Phase 9.1 learner delivery APIs.

Requirements:
- Read-only APIs only
- Source: CoursePackage (published only)
- No admin logic
- No writes

Routes:
GET /api/learn/courses
→ list published courses (id, title, version)

GET /api/learn/courses/[courseId]
→ full CoursePackage JSON

GET /api/learn/courses/[courseId]/lessons/[index]
→ single lesson object

Rules:
- Reject non-PUBLISHED packages
- No mutations
- Use Prisma client
- Add basic Jest tests

Do not add auth yet.


✅ Stop when APIs + tests pass.

🎯 Outcome

A learner can read and navigate a course.
Create a learner Course Player UI.

Pages:

/learn → list courses
/learn/[courseId] → course overview
/learn/[courseId]/lesson/[index] → lesson reader
Requirements:

Read-only
Use Phase 9.1 APIs
Render lesson content cleanly (title, objectives, content blocks)
Navigation: Previous / Next
No progress tracking yet
Constraints:

No admin components
No writes
Mobile-friendly layout
Add minimal styling, no design system needed.

🔹 PHASE 9.3 — Progress Tracking (SAFE WRITES)
🎯 Outcome

Track learner progress without touching content.

Prisma Models (NEW — SAFE)
model Enrollment {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  createdAt DateTime @default(now())
}

model LessonProgress {
  id         String   @id @default(cuid())
  userId     String
  courseId   String
  lessonIdx  Int
  completed  Boolean
  updatedAt  DateTime @updatedAt

  @@unique([userId, courseId, lessonIdx])
}

🧠 Prompt - Phase 9.3
Implement learner progress tracking.

Tasks:
- Add Enrollment and LessonProgress Prisma models
- Create APIs:
  POST /api/learn/enroll
  POST /api/learn/progress
  GET  /api/learn/progress/[courseId]

Rules:
- Progress writes only
- CoursePackage remains immutable
- Require enrollment before progress writes

Add unit tests for:
- enrollment
- marking lesson complete
- reading progress

🔹 PHASE 9.4 — PDF & LMS Exporters
🎯 Outcome

Allow offline / institutional usage.

Export Targets
Export	Format
PDF	Printable course
LMS	SCORM-like ZIP (JSON + HTML)

🧠 Prompt - Phase 9.4 (PDF)
Create a PDF exporter for CoursePackage.

Requirements:
- Input: published CoursePackage JSON
- Output: PDF
- One lesson per section
- Include title, objectives, content

Tech:
- Node PDF library (pdfkit or equivalent)
- No DB writes

Expose function:
exportCourseToPDF(coursePackage): Buffer

Add basic test (snapshot size > 0).

🧠 Prompt - Phase 9.4 (LMS)
Create an LMS exporter.

Requirements:
- Input: CoursePackage JSON
- Output: ZIP
  - index.html
  - lessons/*.html
  - manifest.json

Rules:
- No mutations
- Deterministic output
- No LMS auth logic

Expose function:
exportCourseToLMS(coursePackage): Buffer

🔹 PHASE 9.5 — Multi-Tenant Monetization
🎯 Outcome

Sell courses without forking content.

Prisma Models (NEW)
model Tenant {
  id   String @id @default(cuid())
  name String
}

model Product {
  id        String @id @default(cuid())
  tenantId  String
  courseId  String
  priceCents Int
  currency  String
  active    Boolean
}

model Purchase {
  id        String @id @default(cuid())
  userId    String
  productId String
  createdAt DateTime @default(now())
}

🧠 Copilot Prompt — Phase 9.5
Implement multi-tenant monetization.

Tasks:
- Add Tenant, Product, Purchase models
- APIs:
  GET /api/store/products
  POST /api/store/purchase
- Enforce:
  - purchase required before enrollment
  - tenant isolation

Rules:
- No content duplication
- Product references courseId only
- Purchases grant access, not content ownership

Add tests for:
- access gating
- tenant isolation

🔹 PHASE 9.6 — Access Control & Safety
🎯 Outcome

Prevent leaks and misuse.

🧠  Prompt — Phase 9.6
Add access guards.

Rules:
- Learner APIs require purchase OR enrollment
- Admin APIs unchanged
- CoursePackage JSON never modified

Add middleware:
- requireEnrollment
- requirePurchase (if monetized)

Add tests for unauthorized access.

3️⃣ What You Get at End of Phase 9

✅ Learner platform
✅ Progress tracking
✅ Monetization
✅ Exports (PDF/LMS)
✅ Zero content drift
✅ Enterprise-safe architecture

🚦 What Comes After Phase 9 (Preview Only)
Phase	Focus
10	Analytics & insights
11	Personalization
12	Marketplace
13	AI tutoring layer

What Was Intended

Deliver learner-facing features for Phase 9:
Serve published CoursePackages to learners and lessons via APIs.
Track learner progress and enrollment.
Provide deterministic exporters: PDF and LMS ZIP.
Add monetization (tenant-scoped products, purchases) and require purchase before enroll for paid content.
Enforce safe access guards: learners must have purchase OR enrollment to access paid content.
Replace ad-hoc ?userId= usage with session-derived auth for server handlers and tests.
What We Achieved

Learner APIs:
Read routes for course and lesson content implemented and guarded.
Enrollment API implemented; writes use session-derived user id.
Progress APIs implemented (upsert + read) and use session auth.
Exporters:
PDF exporter in pdf.ts.
Deterministic pure-JS LMS ZIP exporter in lms.ts with matching unit tests (lms.test.ts).
LMS download endpoint added under lms.
Monetization & Store:
Prisma models added: Tenant, Product, Purchase (migration applied).
Store APIs implemented: GET /api/store/products, POST /api/store/purchase.
Enrollment guarded to require purchase if a Product exists for a course.
Auth & Guards:
Central session helper getServerSessionForHandlers() in session.ts (tests can inject global.__TEST_SESSION__).
Access guard hasLearnerAccess(db, userId, courseId) implemented in access.ts.
Updated many routes/tests to use session-derived user id and test session injection.
Quality:
Type-check and ESLint completed with no errors/warnings.
All unit tests pass (19 suites, 54 tests).
Jest config updated to resolve @/ path alias in tests.
What Is Pending

Admin interfaces/APIs:
Tenant-scoped admin endpoints and UI to create/manage Product and Tenant records (not implemented).
Stronger tenant isolation:
Enforcement of tenant ownership on purchase creation and product management could be hardened.
End-to-end auth:
Tests use injected sessions; full integration testing with a real next-auth provider and session cookies not performed.
Audit & logging:
Ensure AuditLog entries are created for admin/store actions (guardrail requires audit logs).
UI/UX:
Admin product management UI, purchase flow UX, and payment integrations (if required) remain to be built.
Operational:
Monitoring/metrics for exporter performance and job handling (if exporter becomes costly).
Suggestions to Make Phase 9 More Complete

Admin product management:
Add secured tenant-admin API routes and a small admin UI to create/update Product and Tenant. Enforce audit logging on all admin actions.
Tenant enforcement:
On purchase creation and product listing, validate tenant membership and scope everything by tenant id to avoid cross-tenant access.
Decouple session resolution for tests:
Keep getServerSessionForHandlers() but add an exported test helper (e.g., withTestSession) so tests set/clear sessions in a single place to reduce repeated boilerplate.
Explicit purchase-enrollment workflows:
Consider an explicit createEnrollmentFromPurchase(purchaseId) flow and background jobs for post-purchase provisioning (immutable jobs per guardrails).
Add integration tests:
Add a small suite of integration tests that spin up a test next-auth provider (or a lightweight mock server) to validate real cookie/session behavior.
Audit & observability:
Wire audit logs (AuditLog) for purchases, enrollment creations, exporter downloads; add simple metrics (counter for exports) and error logging.
Security hardening:
Rate-limit exporter endpoints and validate CoursePackage size before zipping to avoid resource exhaustion.
Documentation:
Add docs/Phase_9_SUMMARY.md with API contracts, guard semantics, and admin flows — useful for onboarding and future phases.
If you want, I can:

Scaffold tenant-admin APIs and a minimal admin UI for managing Product/Tenant.
Add audit-log calls into POST /api/store/purchase and enrollment routes.
Implement the small test helper to centralize global.__TEST_SESSION__ setup/teardown and refactor tests to use it.
Which of those should I do next?


# Phase 9 Hardening


This is the right moment to harden Phase 9 before analytics amplifies anything.

Below is a clear, no-rework, Copilot-ready Phase 9 Hardening plan, broken into atomic steps.
You can paste these one by one, or in small batches (recommended).

🔐 Phase 9 Hardening (Phase 9.5)

Goal:
Make Phase 9 production-safe by adding auditability, tenant isolation, and abuse protection
❌ No new features
❌ No UI redesign
❌ No breaking API changes

HARDENING SCOPE (What & Why)
Area	Why it matters
Audit Logs	Regulatory, debugging, abuse detection
Tenant Scoping	Prevent cross-tenant data leaks
Export Rate Limits	Prevent DoS & cost abuse
Payload Size Guards	Prevent memory / ZIP bomb attacks
✅ STEP 1 — Add Audit Logging (Highest Priority)
Objective

Ensure every sensitive write or export is auditable.

Events to log
Action	Entity	Actor
Product create/update	Product	admin
Purchase creation	Purchase	learner
Enrollment creation	Enrollment	learner
PDF export	CoursePackage	learner
LMS ZIP export	CoursePackage	learner
📌 Copilot Prompt — Step 1
Add audit logging to Phase 9.

Requirements:
1. Use existing AuditLog Prisma model.
2. Create helper function:
   lib/audit/log.ts → logAuditEvent(db, { actorId, action, entityType, entityId, metadata })

3. Add audit log writes to:
   - POST /api/store/purchase
   - Enrollment creation route
   - PDF exporter endpoint
   - LMS exporter endpoint

4. Metadata must include:
   - courseId or packageId
   - tenantId if available
   - timestamp is auto-handled by Prisma

5. Ensure audit logging:
   - Never blocks the main operation
   - Is wrapped in try/catch with error logging

6. Add unit tests verifying:
   - AuditLog row is created for purchase
   - AuditLog row is created for export

Rules:
- No schema changes
- No API response changes
- Type-check and lint must pass


✅ Stop after completing audit logging and tests.

✅ STEP 2 — Enforce Tenant Scoping (Data Safety)
Objective

Prevent cross-tenant access in monetization flows.

Enforcement rules

Product must belong to a tenant

Purchase must reference product’s tenant

Product listing must be tenant-scoped

Learner cannot purchase cross-tenant products

📌 Copilot Prompt — Step 2
Harden tenant isolation in Phase 9 monetization.

Tasks:
1. Enforce tenantId checks in:
   - GET /api/store/products
   - POST /api/store/purchase

2. On purchase creation:
   - Validate product.tenantId === session.tenantId
   - Reject with 403 if mismatch

3. Ensure hasLearnerAccess():
   - Confirms enrollment/purchase belongs to same tenant

4. Add unit tests:
   - Cannot purchase product from another tenant
   - Cannot access course from another tenant

Constraints:
- No new tables
- No UI changes
- Use existing session helper
- Errors must be explicit (403 Forbidden)

Stop after tests pass.

✅ STEP 3 — Rate-Limit Exporters (Abuse Protection)
Objective

Prevent repeated heavy exports.

Policy (simple & safe)

Per-user, per-course

Max 3 exports / 10 minutes

Applies to both PDF and LMS

📌 Copilot Prompt — Step 3
Add rate-limiting to course export endpoints.

Requirements:
1. Create utility:
   lib/rateLimit/exportLimiter.ts

2. Implement in-memory limiter:
   key = `${userId}:${courseId}`
   window = 10 minutes
   max = 3 actions

3. Apply limiter to:
   - PDF export route
   - LMS ZIP export route

4. On limit exceeded:
   - Return HTTP 429
   - Include Retry-After header

5. Add unit tests:
   - 3 exports succeed
   - 4th export fails with 429

Notes:
- Do not introduce Redis yet
- Limiter resets on process restart (acceptable)

Stop after limiter works and tests pass.

✅ STEP 4 — CoursePackage Size Guard (Safety)
Objective

Prevent memory exhaustion or ZIP bombs.

Rules

Max CoursePackage JSON size: 5 MB

Validate before export generation

📌 Copilot Prompt — Step 4
Add CoursePackage size safety guard.

Tasks:
1. Add helper:
   lib/safety/validatePackageSize.ts

2. Validate:
   JSON.stringify(coursePackage).length < 5_000_000 bytes

3. Apply guard to:
   - PDF exporter
   - LMS exporter

4. On violation:
   - Return HTTP 413 Payload Too Large
   - Include clear error message

5. Add tests:
   - Small package passes
   - Oversized package is rejected

Constraints:
- No schema changes
- No UI changes

✅ STEP 5 — Final Verification & Summary
📌 Copilot Prompt — Step 5
Run full verification after Phase 9 hardening.

Checklist:
- npm run lint
- npm run type-check
- npm test

Then:
- Summarize changes
- List all new guards added
- Confirm no breaking API changes

Do not introduce new work.

🎯 Final Outcome After Hardening

You will now have:

✅ Immutable learner content
✅ Deterministic exports
✅ Monetization with tenant isolation
✅ Audit trail for every sensitive action
✅ Abuse-safe exporters
✅ Zero tech debt added

This makes Phase 10 safe, measurable, and trustworthy.