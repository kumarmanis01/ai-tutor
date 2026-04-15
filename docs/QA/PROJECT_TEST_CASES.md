<!--
FILE OBJECTIVE:
- Consolidated QA test cases for the ai-tutor project covering functional, integration, worker, AI, security, performance, accessibility, and regression tests.

LINKED UNIT TEST:
- tests/unit/docs/qa_project_test_cases.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-04-15T00:00:00Z | copilot | created initial QA test cases document
-->

# QA Test Cases — ai-tutor (Project-wide)

## Purpose & Scope
- Objective: Provide a single, actionable test-case document QA can use to validate the entire ai-tutor product (frontend, backend, workers, AI integrations, infra, and non-functional requirements).
- Scope: All user flows, APIs, background jobs, AI guardrails, integrations (OpenAI/Anthropic, Razorpay), and deployment/CI preflight checks.

## How to use this document
- Follow the **Test Case Template** when executing manual tests.
- Execute automated tests where available (`npm test`, CI pipelines) and mark manual checks as pass/fail with logs attached.
- For any blocked test, capture browser/devtools logs, server logs, and steps to reproduce.

## Test Types & Priority
- Type: Functional, Integration, End-to-End (E2E), Regression, Performance, Security, Accessibility, Localization, Smoke.
- Priority: Critical, High, Medium, Low. Start testing with Critical → High.

## Test Environment & Setup (QA checklist)
- Node: use the project's required Node version (check `package.json`).
- Install deps: `npm ci --include=dev`
- DB: Run a dedicated test DB (Postgres/Neon). Create a disposable DB for QA.
- Redis: Start Test Redis (Docker or provided compose).
- Env: copy `.env.example` → `.env.test` and set required values (DB, REDIS, API keys). Do not use production secrets.
- Migrations & seeds: `npx prisma migrate dev --name qa --schema=prisma/schema.prisma` or use provided seed scripts.
- Start services: workers + web per repo guidelines:

```bash
# build & tests gate (required by repo):
npm run build:workers && npm run build && npm test

# dev example (QA interactive):
npm run dev
# start workers (project-specific script):
# npm run start:workers  (if provided) or follow WORKER_README.md
```

- Verify preflight: run `npm run lint` and `npm run type-check` (CI requires these).

## Test Data & Accounts
- Prepare test accounts: student, parent, admin (distinct emails). Use non-production test values.
- Create test subscription/payment test card credentials per Razorpay sandbox.
- Provide example content: short list of questions, topics, and sample media to test uploads.

## Test Case Template (use for each manual case)
- ID: QA-<MODULE>-<NNN>
- Title: short descriptive title
- Objective: what this verifies
- Preconditions: accounts, env, data state
- Steps: numbered steps to reproduce
- Expected Result: exact expected behaviour / message
- Priority: Critical/High/Medium/Low
- Type: functional/integration/e2e/regression/security/performance
- Notes / Attachments: logs, screenshots, recordings

---

## Feature Test Matrix (high-level mapping)
The following sections contain representative and required test cases. Expand them into individual entries using the Test Case Template.

### Authentication & Authorization
- QA-AUTH-001: Sign up (student) — verify email validation, created record, grade locked after first save.
- QA-AUTH-002: Sign in / session expiry — session invalidation, 401 on expired session for API routes.
- QA-AUTH-003: Role-based access — admin-only pages return 403 to regular users.
- QA-AUTH-004: Missing session on API route returns 401 before any DB query (verify no DB fetch when unauthenticated).

### Profile & Onboarding
- QA-PROF-001: Create profile, set grade & board (verify immutability on PATCH — grade/board ignored on update).
- QA-PROF-002: DOB and profile gates — user blocked from certain flows until profile complete.

### Chat AI Tutor (Vidya) — Core flows
- QA-AI-001: Start new chat session — initial greeting, language selection, TTS availability.
- QA-AI-002: Prompt schema enforcement — invalid prompt should be rejected by Zod schema with friendly error.
- QA-AI-003: No direct answers policy — when student asks for solution, Vidya should respond with guiding questions not direct answers.
- QA-AI-004: Hallucination detection — intentionally query with a factual false premise; system should flag/transform or return a safe fallback.
- QA-AI-005: Safe responses pipeline — verify AI output passes: intent classifier → prompt rewriter → hallucination detector → safeResponses → schema validation before saving.
- QA-AI-006: Raw LLM text not stored — verify DB tables do not store raw text (search for `raw` or `llm_response` fields) and audit logs show processing steps instead.
- QA-AI-007: Difficulty tuning deterministic — ask for difficulty change and verify deterministic rule-based output and logged reasoning.

### Speech: Microphone (STT) & Text-to-Speech (TTS)
- QA-SPEECH-001: Microphone capture on low-end Android viewport — audio recorded, STT result appears in chat input.
- QA-SPEECH-002: TTS playback across major browsers and mobile — audio plays, volume acceptable, accessible controls present.
- QA-SPEECH-003: Failure fallback — if STT or TTS service fails, app shows friendly error and allows manual input.

### Payments & Subscriptions (Razorpay)
- QA-PAY-001: Purchase subscription — successful checkout, DB reflects subscription, receipt generated.
- QA-PAY-002: Webhook handling — verify idempotency of webhook processing and no duplicated subscriptions.
- QA-PAY-003: Payment failure handling — user-facing friendly error, no DB side effects.

### Mastery Snapshots, Learning Sessions & Streaks
- QA-MAST-001: Mastery snapshot creation — verify snapshot written when session completes and persisted to DB.
- QA-LEARN-001: Persist LearningSession — starting, resuming, and finishing sessions persist correct timestamps and results.
- QA-STREAK-001: Streak update server-side — client cannot fake streak increments; server enforces rules.

### Workers, Queues & Background Jobs (BullMQ)
- QA-WORK-001: Job enqueue & processing — job created in queue, processed successfully.
- QA-WORK-002: Idempotency — running the same job twice should leave state unchanged beyond intended side effects.
- QA-WORK-003: Redis TTLs — cached items set with correct TTL, expired items removed.
- QA-WORK-004: Retry behavior — failing jobs retried per policy and move to failed queue after threshold.

### API & Backend
- QA-API-001: Student-facing APIs follow schema — responses conform to `lib/api/student/schemas.ts` (no free-form text in structured responses).
- QA-API-002: Error responses format — `{ code, message }` shape and no stack traces returned to client.
- QA-API-003: Rate limiting on sensitive endpoints (OTP, payments) — ensure limits enforced.

### Admin & Content Management
- QA-ADMIN-001: AdminCreateChallenge flow — create challenge, validate fields, visibility toggles work.
- QA-ADMIN-002: Audit trail viewer — admin can view audit events with no PII exposed.

### UI & Accessibility
- QA-UI-001: Mobile-first layout at 360px — verify main screens render without horizontal scroll.
- QA-UI-002: Min touch target — interactive elements meet 44x44px rule.
- QA-UI-003: Keyboard navigation and ARIA attributes — critical pages reachable and usable by keyboard.
- QA-UI-004: Color contrast & dark mode — ensure readable text and maintain design tokens.

### Localization & Copy rules
- QA-I18N-001: Language switching — UI and AI prompts respect selected language (English/Hindi).
- QA-COPY-001: Copy compliance — no banned terms (e.g., "broke", "failed") in streak or progress messages.

### Performance & Scalability
- QA-PERF-001: Load test chat endpoint — sustain N concurrent chat requests (define target with dev/infra team).
- QA-PERF-002: Worker throughput — job processing rates within acceptable bounds.

### Security & Data Handling
- QA-SEC-001: No PII in logs — verify logs do not include names/emails/phone/Aadhaar.
- QA-SEC-002: Input validation — test SQL/command injection attempts are sanitized/blocked.
- QA-SEC-003: Secrets handling — no `dotenv`, `ts-node`, `tsconfig-paths` in `dist/` after build (run grep check per deployment guardrail).

### CI / Build / Deployment Checks
- QA-CI-001: Pre-commit gate — run `python3 scripts/fix-smart-quotes.py` then `npx tsc --noEmit --project tsconfig.json`.
- QA-CI-002: Build gate — `npm run build:workers && npm run build && npm test` must pass.
- QA-CI-003: Dist verification — grep `dist` for forbidden tokens (`dotenv`, `tsconfig-paths`) and expect none.

---

## Representative Detailed Test Cases (examples)

1) QA-AI-002 — No direct answers policy
- Objective: Verify Vidya does not return direct answers on homework-dump requests.
- Preconditions: Logged-in student, a sample homework question that expects an answer.
- Steps:
  1. Open chat and paste a direct homework question (e.g., "What's the answer to question X?").
  2. Send message.
- Expected Result: Vidya asks a guiding question, offers hints or asks the student to explain their approach. No full solution is provided.
- Priority: Critical
- Type: Functional

2) QA-WORK-002 — Job idempotency
- Objective: Ensure repeated processing doesn't create duplicate side effects.
- Preconditions: Known job payload; worker configured for test.
- Steps:
  1. Manually enqueue job J.
  2. Force-run the job twice (simulate duplicate delivery).
- Expected Result: Only one DB state change occurs; second run is a no-op or safely ignored.
- Priority: High
- Type: Integration

3) QA-SEC-003 — Dist forbidden dependency check
- Objective: Ensure production build contains no forbidden runtime dependencies.
- Preconditions: Build produced in `dist/`.
- Steps:
  1. Run grep: `grep -R "dotenv" dist || echo OK` and `grep -R "tsconfig-paths" dist || echo OK`.
- Expected Result: Output `OK` and no matches found.
- Priority: Critical
- Type: Deployment/CI

4) QA-API-001 — API schema validation
- Objective: Verify student API responses match defined schemas and contain no raw AI text fields.
- Preconditions: API server running; test student authenticated.
- Steps:
  1. Call key student API endpoint (e.g., `/api/student/session`) with valid auth.
  2. Validate response JSON against schema in `lib/api/student/schemas.ts`.
- Expected Result: Response conforms; no unstructured LLM text fields included.
- Priority: Critical
- Type: Integration

---

## End-to-End Scenarios (happy paths)
- E2E-01 (Critical): Sign up → complete onboarding → start a learning session → finish session → verify mastery snapshot persisted and streak updated.
- E2E-02 (Critical): Sign in → start AI tutoring session → follow suggested hint → attempt payment to upgrade → verify subscription and access change.
- E2E-03 (High): Simulate AI upstream failure (OpenAI down) → verify failover to Anthropic or safe fallback path and user-facing message.

---

## Non-functional & Edge Cases
- Test network throttling and offline recovery on mobile.
- Test low-memory device behaviours and long-running background tasks.
- Test large payloads (image/audio) upload and graceful rejection limits.

---

## Regression Suite & Acceptance Criteria
- Regression suite must run after each release candidate. Focus on all Critical and High test cases.
- Acceptance: 100% critical tests pass; 95%+ high/medium tests pass per release policy.

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
- When QA finishes the suite, attach a test-results summary with pass/fail counts and blocking issues.
- Sign-off requires all Critical blockers resolved and a re-run of the acceptance regression suite.

---

## Appendix: Useful Commands
- Install: `npm ci --include=dev`
- Lint: `npm run lint`
- Type-check: `npm run type-check`
- Build + workers + tests gate: `npm run build:workers && npm run build && npm test`
- Dist forbidden deps grep (post-build): `grep -R "dotenv" dist || echo OK` etc.

---

If you want, I can:
- convert each entry into individual test-case files under `tests/qa/`,
- produce a CSV export for import into a test-management tool (TestRail, Zephyr), or
- create a short checklist view for manual testers.

