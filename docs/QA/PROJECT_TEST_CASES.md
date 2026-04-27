<!--
FILE OBJECTIVE:
- Consolidated QA test cases for the ai-tutor project covering functional, integration, worker, AI, security, performance, accessibility, and regression tests. Expanded with role-specific test suites for Student, Parent, and Admin.

LINKED UNIT TEST:
- tests/unit/docs/qa_project_test_cases.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-04-15T00:00:00Z | copilot | created initial QA test cases document
- 2026-04-15T12:00:00Z | copilot | expanded with role-based (Admin/Student/Parent) tests and DB validation examples
-->

# QA Test Cases — ai-tutor (Project-wide)

## Purpose & Scope
- Objective: Provide a single, actionable, role-segregated test-case document QA can use to validate the entire ai-tutor product (frontend, backend, workers, AI integrations, infra, and non-functional requirements).
- Scope: All user flows, APIs, background jobs, AI guardrails, integrations (OpenAI/Anthropic, Razorpay), admin surfaces, parent workflows, and CI/deployment checks.

## How to use this document
- Use the **Test Case Template** for each manual test case to ensure consistent reporting.
- Execute automated tests where available (`npm test`, CI pipelines) and mark manual checks as pass/fail with logs and attachments.
- For blocked tests, attach browser/devtools logs, server logs, worker logs, and precise reproduction steps.

## Test Types & Priority
- Type: Functional, Integration, End-to-End (E2E), Regression, Performance, Security, Accessibility, Localization, Smoke.
- Priority: Critical, High, Medium, Low. Start testing with Critical → High.

## Test Environment & Setup (QA checklist)
- Node: use the project's required Node version (check `package.json`).
- Install deps: `npm ci --include=dev`
- DB: run a dedicated test Postgres/Neon instance; use disposable DBs for parallel runs.
- Redis: run a test Redis instance (docker-compose or local container).
- Env: copy `.env.example` → `.env.test` and set test values. Do not use production secrets.
- Migrations & seeds: run migrations and seeds used for QA:

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma
# or for local iterative testing:
npx prisma migrate dev --name qa --schema=prisma/schema.prisma
```

- Start services per repo guidance (web + workers):

```bash
# build & tests gate (required by repo):
npm run build:workers && npm run build && npm test

# dev example (QA interactive):
npm run dev
# start workers (project-specific script) - see WORKER_README.md
```

- Verify preflight: `npm run lint` and `npm run type-check`.

## Test Data & Accounts
- Prepare three canonical test accounts and credentials: `student@example.com`, `parent@example.com`, `admin@example.com` (use unique test UUIDs).
- Use Razorpay sandbox/test cards for payments testing.
- Seed content: add small set of questions/topics and a challenge for functional tests.
- If necessary, create test data directly via SQL or Prisma for stable reproduction (examples below).

## Test Case Template (use for each manual case)
- ID: QA-<ROLE>-<MODULE>-<NNN> (e.g., QA-STU-CHAT-001)
- Title: short descriptive title
- Role: Student | Parent | Admin | Cross-role
- Module: Chat | Payments | Workers | API | UI | etc.
- Objective: single-sentence test goal
- Preconditions: accounts, env, seeded data
- Steps: numbered step-by-step actions
- Expected Result: exact expected behaviour or system response
- DB Validation: SQL / Prisma snippet to validate persistence or side-effect
- API Validation: curl or request example to validate API response
- Priority: Critical/High/Medium/Low
- Type: functional/integration/e2e/regression/security/performance
- Notes / Attachments: logs, screenshots, recordings

---

## Role-based Test Suites
Below are detailed and representative test cases grouped by role. Each entry includes expected DB verification where applicable.

-----------------
STUDENT TEST SUITE
-----------------

QA-STU-001 — Sign up & Onboarding (Critical)
- Objective: Verify student registration, profile create, and grade/board immutability.
- Preconditions: Clean test DB.
- Steps:
  1. Register via UI with `student@example.com` and complete email verification (if enabled).
  2. Complete onboarding: select `grade=8`, `board=CBSE`, fill required fields, save.
  3. Attempt to update profile via PATCH: change `grade` to `9` and `name` to `New Name`.
- Expected Result: The `name` change is accepted; `grade` and `board` remain the original values.
- DB Validation (SQL):

  -- Verify user exists and onboarding values
  SELECT id, email, grade, board, created_at
  FROM "User"
  WHERE email = 'student@example.com';

  -- After attempted PATCH, confirm grade unchanged
  SELECT grade FROM "User" WHERE id = '<user_id>';

- Prisma example:

  const user = await prisma.user.findUnique({ where: { email: 'student@example.com' } });
  // assert user.grade === '8'

Notes: If the system enforces immutability at API layer, ensure the API response does not echo changed grade.

QA-STU-002 — Sign-in & Session Expiry (High)
- Objective: Verify authentication, token/cookie lifecycle, and 401 responses after expiry.
- Steps:
  1. Sign in as `student@example.com`, capture cookie/token.
  2. Manually expire or delete the session server-side (or call sign-out).
  3. Call a protected API (`GET /api/student/session`) with the expired token.
- Expected Result: API returns 401; server performs no DB reads before auth rejection.
- DB Validation (SQL):

  SELECT * FROM "Session" WHERE user_id = '<user_id>' ORDER BY expires_at DESC LIMIT 5;

Notes: If using NextAuth, verify `Session` table contents match the expected expiry.

QA-STU-003 — Chat: Start LearningSession & Persist (Critical)
- Objective: Verify starting a chat creates a `LearningSession` and records messages.
- Steps:
  1. Start a chat with Vidya and send a simple question.
  2. Confirm the UI shows the assistant response.
  3. End session using the app's finish action.
- Expected Result: A `LearningSession` record exists and includes start/finish timestamps and basic metadata.
- DB Validation (SQL):

  SELECT id, user_id, status, started_at, finished_at
  FROM "LearningSession"
  WHERE user_id = '<user_id>'
  ORDER BY created_at DESC LIMIT 1;

  SELECT count(*) FROM "ChatMessage" WHERE session_id = '<session_id>';

- Prisma example:

  const session = await prisma.learningSession.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });

Notes: Confirm that messages/summaries are stored as structured records (no raw LLM text fields persisted).

QA-STU-004 — No Direct Answers Policy (Critical)
- Objective: Ensure Vidya returns guiding prompts, not direct homework solutions.
- Steps:
  1. In chat, paste a homework question and explicitly ask "Give me the answer.".
  2. Observe assistant reply.
- Expected Result: Assistant asks clarifying questions or provides step hints, not the full solution.
- DB / Audit Validation (SQL):

  -- Verify guardrail steps logged in audit
  SELECT id, event_type, payload, created_at
  FROM "AuditEvent"
  WHERE user_id = '<user_id>' AND event_type ILIKE '%ai%'
  ORDER BY created_at DESC LIMIT 5;

Notes: Confirm `intentClassifier` and `promptRewriter` steps were invoked (see audit payload).

QA-STU-005 — Mastery Snapshot Creation (High)
- Objective: When a learning session finishes, a `MasterySnapshot` is created and linked.
- Steps:
  1. Run a full learning session (complete items to trigger snapshot logic).
  2. Observe completion flow and any UI snapshot confirmation.
- Expected Result: `MasterySnapshot` record created with `user_id`, `session_id`, and mastery metrics.
- DB Validation (SQL):

  SELECT id, user_id, session_id, metrics, created_at
  FROM "MasterySnapshot"
  WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;

Prisma example:

  const snap = await prisma.masterySnapshot.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });

QA-STU-006 — Payments: Subscribe (Critical)
- Objective: Verify subscription creation, webhook idempotency, and user access change.
- Steps:
  1. From student account, purchase subscription using Razorpay sandbox.
  2. Validate UI shows premium access and receipt.
  3. Re-send the same webhook payload to test idempotency.
- Expected Result: Single subscription record created; duplicate webhook is ignored (idempotent).
- DB Validation (SQL):

  SELECT id, user_id, status, plan, started_at
  FROM "Subscription"
  WHERE user_id = '<user_id>' ORDER BY started_at DESC LIMIT 1;

  SELECT count(*) FROM "PaymentWebhookLog" WHERE payment_id = '<payment_id>';

Notes: Check `webhook` logs and ensure subscription status transitions are correct.

QA-STU-007 — Streaks (High)
- Objective: Verify server-enforced streak logic and that clients cannot increment arbitrarily.
- Steps:
  1. Complete an eligible action for today.
  2. Trigger the server-side streak update logic (either via UI or worker).
  3. Attempt to submit a fake client-side event to increment streak.
- Expected Result: Only server-authorized events increment streak; invalid client attempts are rejected.
- DB Validation:

  SELECT streak_count, last_active_at FROM "Streak" WHERE user_id = '<user_id>';

Notes: Confirm event provenance is logged in `AuditEvent`.

QA-STU-008 — Accessibility & Mobile Layout (Medium)
- Objective: Verify mobile-first layout (360px) and min touch targets.
- Steps:
  1. Open key flows on emulated 360px viewport; inspect touch targets and layout.
  2. Test keyboard navigation and ARIA attributes.
- Expected Result: No horizontal scroll; buttons meet 44x44px target; ARIA present.

-----------------
PARENT TEST SUITE
-----------------

QA-PAR-001 — Parent Sign-up & Link Child (Critical)
- Objective: Verify parent account creation and linking to an existing child account.
- Steps:
  1. Register as `parent@example.com`.
  2. Use the app flow to add/link a child (enter child's email or code).
  3. Verify child receives notification and the link is established.
- Expected Result: Parent-child relationship exists and parent can view child's summary.
- DB Validation (SQL):

  SELECT parent_id, child_id FROM "ParentChild" WHERE parent_id = '<parent_id>' AND child_id = '<child_id>';

Prisma example:

  const rel = await prisma.parentChild.findFirst({ where: { parentId: '<parent_id>', childId: '<child_id>' } });

QA-PAR-002 — View Child Progress & Reports (High)
- Objective: Parent can view child's learning sessions, mastery snapshots, and streaks.
- Steps:
  1. Login as parent and navigate to child's dashboard.
  2. Inspect learning history, mastery snapshots, and streak information.
- Expected Result: Data matches child's records with no PII leakage.
- DB Validation:

  SELECT ls.id, ls.started_at, ms.metrics
  FROM "LearningSession" ls
  JOIN "MasterySnapshot" ms ON ms.session_id = ls.id
  WHERE ls.user_id = '<child_user_id>'
  ORDER BY ls.started_at DESC LIMIT 20;

QA-PAR-003 — Parent Purchase for Child (High)
- Objective: Parent can pay for child's subscription and the subscription maps correctly.
- Steps:
  1. From parent account, purchase a subscription for the child.
  2. Verify the child's account now has premium access.
- Expected Result: Subscription record exists for the child, and access toggles accordingly.
- DB Validation:

  SELECT id, user_id, purchased_by_parent_id, status FROM "Subscription" WHERE user_id = '<child_id>' AND purchased_by_parent_id = '<parent_id>';

-----------------
ADMIN TEST SUITE
-----------------

QA-ADM-001 — Admin Access & RBAC (Critical)
- Objective: Ensure admin-only pages and APIs are protected and reject non-admin users.
- Steps:
  1. Login as `admin@example.com` and access admin dashboard and APIs.
  2. Login as regular user and attempt same requests.
- Expected Result: Admin access allowed; regular user receives 403.
- DB Validation:

  SELECT id, email, role FROM "User" WHERE email IN ('admin@example.com', 'student@example.com');

QA-ADM-002 — Create / Publish Content (High)
- Objective: Admin can create a challenge and publish it; published content visible to students per rollout config.
- Steps:
  1. As admin, create a new challenge with unique title `QA: Test Challenge`.
  2. Publish the challenge and set visibility flags.
  3. As a student, verify visibility following rollout rules.
- Expected Result: Challenge persisted and visible per rollout/feature-flag configuration.
- DB Validation (SQL):

  SELECT id, title, status, visibility FROM "Challenge" WHERE title = 'QA: Test Challenge';

QA-ADM-003 — Audit Trail & Compliance (High)
- Objective: Verify audit events for critical admin actions and ensure no PII leaks in audit logs.
- Steps:
  1. As admin, perform a content edit and a user role change.
  2. Query audit logs for events and verify payload and context.
- Expected Result: Audit events recorded with event_type, actor_id, target_id, and non-sensitive payload.
- DB Validation:

  SELECT id, event_type, actor_id, target_id, payload, created_at FROM "AuditEvent" WHERE actor_id = '<admin_id>' ORDER BY created_at DESC LIMIT 10;

QA-ADM-004 — Workers & Job Orchestration (High)
- Objective: Admin can requeue jobs and inspect worker health; jobs are idempotent.
- Steps:
  1. Create or requeue a job via admin UI/API.
  2. Observe worker processing and job result.
  3. Re-run the same job payload to test idempotency.
- Expected Result: Job processed once with correct side-effects; duplicate execution does not create duplicate records.
- DB Validation:

  SELECT job_id, status, attempts, last_error FROM "JobLog" WHERE job_id = '<job_id>' ORDER BY created_at DESC LIMIT 10;

QA-ADM-SEC-001 — Dist Forbidden Dependency Check (Critical)
- Objective: Ensure production `dist/` contains no forbidden runtime dependencies.
- Steps:
  1. After running build, run:

  ```bash
  grep -R "dotenv" dist || echo OK
  grep -R "tsconfig-paths" dist || echo OK
  ```

- Expected Result: `OK` output and no matches.

-----------------
CROSS-ROLE END-TO-END SCENARIOS
-----------------

E2E-01 — Full happy path (Critical)
- Sign up student → complete onboarding → admin publishes a challenge → student attempts challenge → finishes session → mastery snapshot created → parent views child progress.
- DB validations: verify `LearningSession`, `MasterySnapshot`, `Challenge` visibility, and `ParentChild` relation.

E2E-02 — Payment and Access Change (Critical)
- Student flows: start as free user → purchase subscription → verify premium endpoints accessible.
- DB validations: `Subscription` state and `Access` toggles for user.

---

## DB Validation & Query Examples (Common entities)
The following are canonical SQL and Prisma snippets QA can use to validate the most common entities. Replace `<user_id>` and `<session_id>` with real values from the test run.

User lookup (SQL):

  SELECT id, email, role, grade, board, created_at FROM "User" WHERE email = 'student@example.com';

Prisma:

  const u = await prisma.user.findUnique({ where: { email: 'student@example.com' } });

LearningSession (SQL):

  SELECT id, user_id, status, started_at, finished_at FROM "LearningSession" WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;

MasterySnapshot (SQL):

  SELECT id, user_id, session_id, metrics FROM "MasterySnapshot" WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;

Subscription (SQL):

  SELECT id, user_id, plan, status, started_at FROM "Subscription" WHERE user_id = '<user_id>' ORDER BY started_at DESC LIMIT 1;

Audit events (SQL):

  SELECT id, event_type, actor_id, payload, created_at FROM "AuditEvent" WHERE actor_id = '<actor_id>' ORDER BY created_at DESC LIMIT 50;

Generic column scan for LLM/raw fields (SQL):

  SELECT table_name, column_name FROM information_schema.columns WHERE column_name ILIKE '%llm%' OR column_name ILIKE '%raw%';

Notes: Use the generic scan to confirm no raw LLM text columns exist in production schemas. If fields are present, validate they are not populated with raw LLM outputs.

## API Verification Examples
- Protected API call (curl):

  curl -H "Authorization: Bearer <token>" https://localhost:3000/api/student/session

- Validate response shape against `lib/api/student/schemas.ts`. For automation, use a JSON schema validator in tests.

## Worker / Queue Checks
- Inspect job history via admin APIs or directly query `JobLog`/queue tables.
- Verify retries, failures, and TTLs for Redis-backed caches.

## Security & Compliance Checks
- Confirm no PII in logs. Grep for sample PII patterns is not foolproof; prefer structured log review.
- Validate rate limits for sensitive endpoints (OTP, payments).

## Regression Suite & Acceptance Criteria
- Run the regression suite against the release candidate. Critical tests: 100% pass. High/Medium acceptance: 95%+.

## Bug Report Template (copy into issue)
- Title: [QA][<Priority>] Short description
- Steps to reproduce: numbered
- Expected result:
- Actual result:
- Environment: branch, commit, Node, DB, Redis, browser, device
- Logs / screenshots / recordings: attach
- Severity: Critical/High/Medium/Low
- Suggested owner / area: (frontend/backend/worker/AI)

---

## Handoff & Sign-off
- When QA finishes, attach a test-results summary with pass/fail counts, logs, and blocking issues.
- Sign-off: all Critical blockers resolved and acceptance regression re-run.

---

If you want, I can:
- convert each role/test into individual test-case files under `tests/qa/` (YAML/JSON/Markdown),
- export a CSV for TestRail/Zephyr import,
- or scaffold automated Jest integration tests for selected critical flows.

