# Spinzy — Admin & Content Pipeline Tasks

# Based on Task A1 audit findings — 2026-03-15

#

# HOW TO USE:

# Paste each task into Claude Code in order.

# Gate between every task: npm run build:workers && npm run build && npm test

#

# ROLE FOR ALL TASKS IN THIS FILE:

# Principal Software Architect — apply all rules from CLAUDE.md

---

## ADMIN TASK COMPLETION STATUS

| Task                                  | Status      | Notes                                                       |
| ------------------------------------- | ----------- | ----------------------------------------------------------- |
| A1 — Audit                            | ✅ Complete | Findings documented above                                   |
| A2 — Grade backdoor + AuditLog schema | ✅ Complete | 46 files, 1204/1204 tests                                   |
| A3 — Question flagging + quarantine   | ✅ Complete | 10 call sites filtered, flag UI in chat panel               |
| A4 — Admin CLI scripts                | ✅ Complete | 8 commands, AccountStatus enum extended                     |
| A5 — Doubt escalation queue           | ✅ Complete | 7 files, ran before A3                                      |
| A6 — Session quality sampling         | ✅ Complete | QualityFlag schema, sample API, quality-review.cjs          |
| A7 — Cost anomaly detection           | ✅ Complete | 4 anomaly conditions, rolling average, cache hit rate       |
| A8 — DPDP right-to-erasure            | ✅ Complete | 2-phase worker, deletion request API, profile UI            |
| A9 — Minimal admin web UI             | ✅ Complete | 5 pages: dashboard, costs, sessions, questions, escalations |
| A10 — Content ingestion v2            | ✅ Complete | SHA-256 versioning, IngestRunLog, real PDF endpoint         |

---

### What exists and works:

- Single BullMQ queue `content-hydration` — syllabus/notes/questions/assemble workers ✅
- HydrationJob full lifecycle with JobLock, reconciler, outbox ✅
- GeneratedQuestion → Question lazy promotion via lib/tests.ts ✅
- AuditLog table (thin schema, used inconsistently) — exists
- DailyCostMetric + cost reporting worker — exists
- seed-taxonomy-launch-slice.ts — complete, idempotent ✅
- QuestionFlag model — exists but wired to wrong model

### Critical gaps found:

- PDF ingestion endpoint is a non-persisting stub (logs to console only)
- QuestionFlag wired to StudentQuestion (doubts), NOT to Question (sessions)
- PATCH /api/admin/users/[id] passes full body to prisma.update() — grade can be
  changed by admin without audit log — backdoor around grade immutability rule
- No QUARANTINED status on Question model
- No session quality sampling
- No doubt escalation queue
- No DPDP erasure workflow
- AuditLog schema missing: entityType, entityId, previousValue, newValue, ipAddress
- Cost anomaly detection is static threshold only — no rolling average

---

## TASK A2 — Fix admin grade-change backdoor + harden AuditLog schema ✅

```
/run grep -rn "api/admin/users" app/api/admin/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -10
/run cat app/api/admin/users/\[id\]/route.ts 2>/dev/null | head -60
/run cat prisma/schema.prisma | grep -A15 "model AuditLog"

Read all files found. This is a security fix — do it before any other admin task.

PART 1 — Fix the grade-change backdoor in PATCH /api/admin/users/[id]:

The current PATCH handler passes the full request body to prisma.user.update()
without stripping grade. An admin can silently change a student's grade with
no audit trail. Fix:

1. In PATCH /api/admin/users/[id]/route.ts:
   - Parse request body
   - If body contains `grade`: this is a deliberate grade override (admin-only action)
     - Fetch current grade first: const { grade: previousGrade } = await prisma.user.findUnique(...)
     - Apply the grade change
     - Write AuditLog entry: action='GRADE_CHANGE', entityType='User', entityId=userId,
       previousValue={ grade: previousGrade }, newValue={ grade: body.grade },
       reason=body.reason (required for grade changes — return 400 if missing)
     - Also: delete StudentConceptState rows for this student's concepts in affected subjects
       (grade change invalidates all mastery data)
     - Also: delete LearningPlan rows for this student (plan must be regenerated)
   - For all other fields: strip grade before the general update (same as student PATCH)
   - Add comment: // grade changes require explicit reason + audit log — handled above

PART 2 — Harden AuditLog schema:

Current schema is thin (id, userId, action, details, createdAt).
Migrate to:

model AuditLog {
  id            String          @id @default(cuid())
  adminId       String?         // who performed the action (null = system)
  targetEntity  String          // 'User' | 'Question' | 'Subscription' | 'HydrationJob'
  targetId      String          // the ID of the affected entity
  action        AdminActionType // typed enum replaces free-text action string
  previousValue Json?           // state before change
  newValue      Json?           // state after change
  reason        String?         // required for destructive actions
  ipAddress     String?
  createdAt     DateTime        @default(now())
  admin         User?           @relation("AdminActions", fields: [adminId], references: [id])
  @@index([targetEntity, targetId])
  @@index([adminId, createdAt])
}

enum AdminActionType {
  GRADE_CHANGE
  DIAGNOSTIC_RESET
  ACCOUNT_SUSPEND
  ACCOUNT_REACTIVATE
  ACCOUNT_DEACTIVATE
  SUBSCRIPTION_EXTEND
  SUBSCRIPTION_REFUND
  QUESTION_QUARANTINE
  QUESTION_APPROVE
  QUESTION_REJECT
  FEATURE_FLAG_CHANGE
  ERASURE_REQUEST
  ERASURE_PSEUDONYMISE
  ERASURE_PURGE
  CONTENT_APPROVE
  DOUBT_RESOLVE
}

IMPORTANT: The existing AuditLog.action is a String. The migration must:
1. Add all new columns as nullable first
2. Migrate existing rows: set targetEntity='User', targetId=userId,
   action='ACCOUNT_SUSPEND' for existing 'soft_delete_user' rows
3. Drop the old action String column
4. Add the new action AdminActionType column
5. Make targetEntity and targetId non-nullable after migration

Run:
/run npx prisma migrate dev --name harden_audit_log_schema
/run npx prisma generate

Update the soft_delete_user code in DELETE /api/admin/users/[id] to use the new schema.

Run npm run build && npm test — report every file changed.
```

---

## TASK A3 — Wire question flagging to session questions + auto-quarantine

```
/run cat prisma/schema.prisma | grep -A20 "model QuestionFlag\|model Question\b" | head -60
/run grep -rn "QuestionFlag\|questionFlag" app/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20
/run grep -rn "status.*QUARANTINE\|QUARANTINE\|quarantine" prisma/schema.prisma lib/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | head -10

Read all files found.

The audit found: QuestionFlag model exists but is wired to StudentQuestion (doubt questions),
NOT to Question (session questions from the AI pipeline).
There is no QUARANTINED status on the Question model.

PART 1 — Add QUARANTINED status to Question model:

Check if Question has a status field. If not, add:
  status  QuestionStatus  @default(ACTIVE)

enum QuestionStatus {
  ACTIVE
  QUARANTINED
  REJECTED
  PENDING_REVIEW
}

Run: /run npx prisma migrate dev --name add_question_status

PART 2 — Add a second QuestionFlag relation targeting Question (not StudentQuestion):

The existing QuestionFlag model targets StudentQuestion — do NOT change that.
Add a NEW model SessionQuestionFlag:

model SessionQuestionFlag {
  id         String       @id @default(cuid())
  questionId String
  studentId  String
  reason     FlagReason
  details    String?
  createdAt  DateTime     @default(now())
  question   Question     @relation(fields: [questionId], references: [id])
  student    User         @relation(fields: [studentId], references: [id])
  @@unique([questionId, studentId])  // one flag per student per question
  @@index([questionId])
}

enum FlagReason {
  WRONG_ANSWER
  AMBIGUOUS
  TYPO
  OFF_TOPIC
  TOO_EASY
  TOO_HARD
}

Add back-relation to Question: sessionFlags SessionQuestionFlag[]
Add back-relation to User: sessionQuestionFlags SessionQuestionFlag[]

Run: /run npx prisma migrate dev --name add_session_question_flag
Run: /run npx prisma generate

PART 3 — Flag API:

Create app/api/student/question/[questionId]/flag/route.ts (POST):
- Auth-guarded (student only)
- Body: { reason: FlagReason, details?: string }
- Upsert SessionQuestionFlag (@@unique prevents duplicate)
- After upsert: count total SessionQuestionFlag rows for this questionId
- If count >= 3:
    await prisma.question.update({
      where: { id: questionId },
      data: { status: 'QUARANTINED' }
    })
    // Write audit log
- Return: { flagged: true, totalFlags: number }

PART 4 — Exclude quarantined questions from all serving queries:

Grep for every prisma.question.findMany() and prisma.question.findFirst() in the codebase:
/run grep -rn "prisma.question.find\|prisma\.question\.find" lib/ app/ services/ --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next"

For every result: add status: 'ACTIVE' to the where clause if not already present.
Add comment: // quarantined questions excluded — do not remove this filter

PART 5 — "Flag this question" button in session UI:

In the AI tutor session (wherever MCQ questions are rendered to students —
check components/student/session/ and AITutorChatPanel):
- Add a small text link "Flag question" below each MCQ (not prominent, not disruptive)
- Only show when a questionId is present in the current turn context
- On tap: POST /api/student/question/[questionId]/flag { reason: 'WRONG_ANSWER' }
  (use WRONG_ANSWER as default — simple one-tap, no reason picker in session)
- On success: "Thanks for flagging — we'll review it" toast, session continues

Run npm run build && npm test — report every file changed.
```

---

## TASK A4 — Admin CLI scripts for user operations

```
/run find scripts -type f \( -name "*.ts" -o -name "*.cjs" \) 2>/dev/null | grep -v node_modules | head -20
/run cat scripts/set-rollout.cjs 2>/dev/null | head -30
/run grep -rn "suspend\|reactivate\|resetDiagnostic\|diagnosticReset" app/api/admin/ lib/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -10

Read all files found. Model the new admin.cjs script on the existing set-rollout.cjs pattern.

Create scripts/admin.cjs — multi-command admin CLI.
Reads DATABASE_URL from .env.production or process.env.

Commands to implement:

node scripts/admin.cjs suspend-user --userId <id> --reason "reason text"
  - Sets User.accountStatus = 'suspended'
  - Writes AuditLog: action=ACCOUNT_SUSPEND, targetEntity='User', targetId, reason, ipAddress=null
  - Outputs: ✅ User <id> suspended

node scripts/admin.cjs reactivate-user --userId <id>
  - Sets User.accountStatus = 'active'
  - Writes AuditLog: action=ACCOUNT_REACTIVATE
  - Outputs: ✅ User <id> reactivated

node scripts/admin.cjs reset-diagnostic --userId <id> --subjectId <id> --reason "reason"
  - Fetches all conceptIds for this subject
  - Deletes StudentConceptState rows for studentId + those conceptIds
  - Deletes LearningPlan for studentId + subjectId
  - Deletes partial diagnostic Redis key: diagnostic:partial:{userId}:{subjectId}
  - Writes AuditLog: action=DIAGNOSTIC_RESET, previousValue={ conceptStateCount }
  - Outputs: ✅ Diagnostic reset for user <id> subject <id> (N concept states deleted)

node scripts/admin.cjs extend-subscription --userId <id> --days 30 --reason "reason"
  - Finds active Subscription for user
  - Updates expiresAt += N days
  - Writes AuditLog: action=SUBSCRIPTION_EXTEND, previousValue={ expiresAt }, newValue={ expiresAt }
  - Outputs: ✅ Subscription extended by 30 days, new expiry: <date>

node scripts/admin.cjs list-escalations
  - Queries DoubtEscalation WHERE resolvedAt IS NULL (after Task A5 builds this)
  - Until Task A5: outputs "Doubt escalation queue not yet built — run Task A5"

node scripts/admin.cjs list-quarantined
  - Queries Question WHERE status = 'QUARANTINED'
  - Outputs table: id | topic | flags | quarantinedAt

node scripts/admin.cjs view-audit-log --userId <id> [--limit 20]
  - Queries AuditLog WHERE targetId = userId OR adminId = userId
  - Outputs table: createdAt | action | targetEntity | reason

node scripts/admin.cjs change-grade --userId <id> --grade <6-12> --reason "reason"
  - Fetches current grade
  - PROMPTS: "⚠️ Grade change is irreversible and resets all concept states. Type YES to confirm: "
  - On YES: update User.grade, delete StudentConceptState, delete LearningPlan,
    write AuditLog action=GRADE_CHANGE with previousValue+newValue
  - On anything else: "Aborted — no changes made"

ALL commands must:
- Require --reason for destructive actions (suspend, grade-change, reset-diagnostic)
  Return error if reason is missing: "❌ --reason is required for this operation"
- Print clear success or failure
- Never throw without a human-readable error message
- Never require the app to be running — direct DB access only

Run npm run build && npm test — report every file created.
```

---

## TASK A5 — Doubt escalation queue

```
/run grep -rn "StudentQuestion\|doubt.*attempt\|doubt.*fail\|doubt.*escalat" lib/ services/ app/ --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20
/run cat services/tutor/turn.ts 2>/dev/null | grep -n "doubt\|question\|StudentQuestion" | head -20

Read all files found.

The audit found: no doubt escalation exists anywhere.
This task builds the full escalation pipeline from detection to admin resolution.

PART 1 — Schema:

Add to prisma/schema.prisma:

model DoubtEscalation {
  id             String    @id @default(cuid())
  studentId      String
  sessionId      String
  conceptId      String?
  doubtText      String    // the student's question (already PII-redacted)
  aiAttempts     Json      // Array<{ turnId: string, aiResponse: string }> — last 3
  resolvedAt     DateTime?
  resolutionType String?   // 'chunk_updated'|'misconception_added'|'prompt_fix'|'cached_answer'
  resolutionNote String?
  createdAt      DateTime  @default(now())
  student        User      @relation(fields: [studentId], references: [id])
  @@index([resolvedAt, createdAt])
  @@index([conceptId])
}

Run: /run npx prisma migrate dev --name add_doubt_escalation
Run: /run npx prisma generate

PART 2 — Detection in orchestrator:

In services/tutor/turn.ts, track consecutive doubt turns in Redis:
Key: session:{sessionId}:doubt_streak
TTL: 3600s (reset on any non-doubt turn)

Define a doubt turn as: student message ends with '?' OR current turn is tagged as
a clarification/doubt type (check how doubt turns are currently classified in the
stage machine — search for 'doubt' or 'clarification' in the turn processor).

On each doubt turn:
  const count = await redis.incr(`session:${sessionId}:doubt_streak`)
  await redis.expire(`session:${sessionId}:doubt_streak`, 3600)

On any non-doubt turn (student answers a practice question correctly etc.):
  await redis.del(`session:${sessionId}:doubt_streak`)

If count === 3:
  - Load last 3 AITutorTurnLog rows for this session
  - Create DoubtEscalation row
  - Reset counter: await redis.del(`session:${sessionId}:doubt_streak`)
  - Log event: doubt_escalated, sessionId, conceptId

PART 3 — Admin API:

Create app/api/admin/escalations/route.ts (GET):
  - Admin role only
  - Returns DoubtEscalation WHERE resolvedAt IS NULL ORDER BY createdAt ASC
  - Returns: { escalations: [], count: number }

Create app/api/admin/escalations/[id]/resolve/route.ts (POST):
  - Admin role only
  - Body: { resolutionType: string, resolutionNote: string }
  - Sets resolvedAt = now(), resolutionType, resolutionNote
  - Writes AuditLog: action=DOUBT_RESOLVE
  - Returns: { resolved: true }

PART 4 — Trending alert in cost report:

In worker/services/costReportingWorker.ts, add after the main report:
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const trending = await prisma.$queryRaw`
    SELECT "conceptId", COUNT(DISTINCT "studentId") as studentCount
    FROM "DoubtEscalation"
    WHERE "createdAt" >= ${sevenDaysAgo} AND "conceptId" IS NOT NULL
    GROUP BY "conceptId"
    HAVING COUNT(DISTINCT "studentId") >= 5
  `
  If trending has results: add to cost report email:
  "⚠️ Trending doubts (5+ students same concept this week): [list conceptIds]"

Run npm run build:workers && npm run build && npm test
```

---

## TASK A6 — Session quality sampling + quality flag API

```
/run grep -rn "qualityFlag\|quality_flag\|QualityFlag" prisma/schema.prisma lib/ app/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | head -10
/run cat prisma/schema.prisma | grep -A10 "model AITutorTurnLog"
/run find app/api/admin/sessions -type f 2>/dev/null | grep -v node_modules

Read all files found.

PART 1 — Add quality flag fields to AITutorTurnLog:

Check if qualityFlag exists. If not, add to AITutorTurnLog:
  qualityFlag  QualityFlag?
  qualityNote  String?

enum QualityFlag {
  HALLUCINATION
  INCORRECT_EXPLANATION
  POOR_PEDAGOGY
  OFF_TOPIC
  DIRECT_ANSWER_GIVEN
  SAFETY_CONCERN
}

Run: /run npx prisma migrate dev --name add_quality_flag_to_turn_log
Run: /run npx prisma generate

PART 2 — Session sampling API:

Create app/api/admin/sessions/sample/route.ts (GET):
  Admin role only.
  Query: 10 random StructuredSession rows from yesterday (IST) with at least 1 turn.
  Use raw SQL for RANDOM() since Prisma doesn't support it:
    SELECT s.id, s."studentId", s."startedAt", s."completedAt",
           COUNT(t.id)::int as "turnCount"
    FROM "StructuredSession" s
    JOIN "AITutorTurnLog" t ON t."sessionId" = s.id
    WHERE s."startedAt" >= ${yesterdayStart} AND s."startedAt" < ${todayStart}
    GROUP BY s.id, s."studentId", s."startedAt", s."completedAt"
    ORDER BY RANDOM()
    LIMIT 10
  For each session: include first 5 AITutorTurnLog rows
    (select: id, role, message truncated to 300 chars, stage, qualityFlag, createdAt)
  Returns: { sessions: SessionSample[], date: string, totalYesterday: number }

PART 3 — Quality flag API:

Create app/api/admin/sessions/[sessionId]/flag/route.ts (POST):
  Admin role only.
  Body: { turnId: string, flag: QualityFlag, note: string }
  Updates AITutorTurnLog: set qualityFlag, qualityNote where id = turnId
  Writes AuditLog: action=CONTENT_APPROVE (reuse for quality flag),
    targetEntity='AITutorTurnLog', targetId=turnId,
    newValue={ flag, note }
  Returns: { flagged: true }

PART 4 — Daily quality review script:

Create scripts/quality-review.cjs:
  node scripts/quality-review.cjs [--date YYYY-MM-DD]

  1. Calls GET /api/admin/sessions/sample (or direct DB query)
  2. For each session prints:
     Session: <id> | Student: <first 8 chars of id> | Duration: Nmin | Turns: N
     Turn samples (first 3 AI turns, 200 chars each):
       [HOOK] Vidya: "..."
       [PRACTICE] Vidya: "..."
  3. After printing all 10 sessions prompts:
     "Flag a turn? Enter <sessionId>:<turnId>:<flag> or press Enter to skip: "
     Flags: H=hallucination, I=incorrect_explanation, P=poor_pedagogy, T=off_topic,
            D=direct_answer_given, S=safety_concern
  4. On valid input: POSTs to flag API or direct DB update
  5. Prints: "✅ Flagged <turnId> as <flag>"

PART 5 — Add quality flag summary to weekly cost email:

In costReportingWorker.ts, add to the weekly report (Sunday runs):
  - Count of qualityFlag rows by type for last 7 days
  - If DIRECT_ANSWER_GIVEN > 0: add ⚠️ CRITICAL warning (violates core product rule)
  - Format: "Quality flags this week: hallucination:N, direct_answer:N, off_topic:N"

Run npm run build:workers && npm run build && npm test
```

---

## TASK A7 — Cost anomaly detection with rolling average

```
/run cat worker/services/costReportingWorker.ts

Read the file. Extend the existing worker — do not rewrite it.

Current state (from audit): static $0.003 threshold only. No rolling average.

Add after the existing threshold check:

1. Load last 7 days of DailyCostMetric (excluding today):
   const last7 = await prisma.dailyCostMetric.findMany({
     where: { date: { gte: sevenDaysAgo, lt: todayStart } },
     orderBy: { date: 'desc' },
     take: 7,
   })

2. Compute rolling average:
   const rollingAvg = last7.length >= 3  // need at least 3 data points
     ? last7.reduce((s, d) => s + d.costPerSession, 0) / last7.length
     : null  // not enough history — skip anomaly check

3. Anomaly conditions (any triggers an alert):
   - costPerSession > 0.003  (existing — keep)
   - rollingAvg !== null && costPerSession > rollingAvg * 1.5  (50% above rolling avg)
   - totalCostUsd > 15  (hard daily ceiling — $15 USD ≈ ₹1,250)
   - sessions === 0 && yesterday?.sessions > 10  (sudden dropout — likely outage)

4. Alert email subject must indicate which condition triggered:
   - "⚠️ Cost spike: N× above 7-day average"  (for rolling avg breach)
   - "⚠️ Cost threshold: ₹X per session"  (for static threshold breach)
   - "⚠️ Zero sessions — possible outage"  (for dropout)
   - "⚠️ Daily cost ceiling reached: $X"  (for hard ceiling)

5. Add cache hit rate monitoring:
   const { cacheHitRate, totalTurns } = await prisma.aITutorTurnLog.aggregate({
     where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
     _count: { id: true },
     _sum: { cached: true }  // cached is Boolean — sum counts trues if 1/0
   })
   // If Prisma can't sum booleans: use $queryRaw
   // SELECT COUNT(*) FILTER (WHERE cached = true)::float / NULLIF(COUNT(*),0)
   // FROM "AITutorTurnLog" WHERE "createdAt" >= $1

   Add to email:
   "Cache hit rate: N% (target >55%)"
   If < 55%: "⚠️ Cache hit rate below target — check explanation cache"

Run npm run build:workers && npm run build && npm test
```

---

## TASK A8 — DPDP right-to-erasure workflow

```
/run grep -rn "erasure\|deletion.*request\|DeletionRequest\|purge\|pseudonymise" prisma/schema.prisma lib/ app/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -10
/run find app/\(student\)/profile -type f 2>/dev/null | grep -v node_modules

Read all files found.

Add to prisma/schema.prisma:

model DeletionRequest {
  id              String    @id @default(cuid())
  userId          String    @unique
  requestedAt     DateTime  @default(now())
  pseudonymisedAt DateTime?
  purgedAt        DateTime?
  retainAuditLog  Boolean   @default(true)
  user            User      @relation(fields: [userId], references: [id])
}

Run: /run npx prisma migrate dev --name add_deletion_request
Run: /run npx prisma generate

PART 1 — Request endpoint:

Create app/api/student/account/deletion-request/route.ts (POST):
  - Auth-guarded
  - Check no existing DeletionRequest for this user (idempotent — return existing if found)
  - Create DeletionRequest row
  - Set User.accountStatus = 'deletion_pending'
  - Send confirmation email via lib/mailer.ts:
    Subject: "Your data deletion request — Spinzy"
    Body: "We've received your request. Your account has been deactivated.
           Your personal data will be anonymised within 7 days and
           permanently deleted within 30 days. Learning analytics are
           retained anonymously as required by law."
  - Write AuditLog: action=ERASURE_REQUEST
  - Return: { requested: true, scheduledPseudonymiseDate, scheduledPurgeDate }

PART 2 — Nightly deletion worker:

Create worker/services/dataDeletionWorker.ts:
  BullMQ repeatable job, cron '30 20 * * *' (02:00 AM IST), timezone 'Asia/Kolkata'

  Phase 1 — Pseudonymise (requestedAt > 7 days ago AND pseudonymisedAt IS NULL):
    For each qualifying DeletionRequest:
    - Update User: name='Deleted User', email=`deleted_${id}@deleted.spinzy.com`,
      phone=null, age=null, parentPhone=null, parentEmail=null
    - Delete Consent rows for this user
    - Set DeletionRequest.pseudonymisedAt = now()
    - Write AuditLog: action=ERASURE_PSEUDONYMISE

  Phase 2 — PII purge (pseudonymisedAt > 30 days ago AND purgedAt IS NULL):
    For each qualifying DeletionRequest:
    - Update AITutorTurnLog rows for this user's sessions:
      set studentMessage = '[PURGED]', rawInput = '[PURGED]' (if field exists)
    - Delete SafetyEvent rows for this user
    - Delete DoubtEscalation rows for this user
    - Delete SessionQuestionFlag rows for this user
    - Keep: StructuredSession (anonymised), DailyCostMetric, AuditLog (legal 7yr requirement)
    - Set DeletionRequest.purgedAt = now()
    - Write AuditLog: action=ERASURE_PURGE
    - Log: { userId: '[PURGED]', purgedAt } — never log the actual userId after purge

  Register in worker/bootstrap.ts and scheduler.ts.
  Never throws — catch and log all errors, continue to next request.

PART 3 — Student-facing delete account UI:

Find where app/(student)/profile exists or create app/(student)/student/profile/page.tsx.
Add a "Privacy & Data" section with:
  "Delete my account and data"
  Sub-text: "Permanently deletes your account and personal data within 30 days.
             Learning analytics are kept anonymously."
  Button: "Request account deletion" (styled as destructive — red border, not filled)
  On click: show confirmation dialog:
    "This cannot be undone. Type DELETE to confirm:"
    Text input — button stays disabled until value === 'DELETE'
  On confirm: POST /api/student/account/deletion-request
  On success: redirect to /login with message "Your deletion request has been submitted."

Run npm run build:workers && npm run build && npm test
```

---

## TASK A9 — Minimal admin web UI

```
/run find app/\(admin\) -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components/admin -type f 2>/dev/null | grep -v node_modules
/run grep -rn "role.*admin\|isAdmin\|admin.*role" lib/ app/ --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -10

Read all files found. Check if any admin UI exists already.

This is a READ-ONLY-FIRST minimal admin UI — enough for daily operations.
No Tailwind animations. Functional over beautiful. Desktop only.

1. Create app/(admin)/layout.tsx:
   Server component.
   Session check: requireActiveSession() → if null: redirect('/login')
   Role check: if session.user.role !== 'admin': redirect('/dashboard')
   Simple full-width layout with a left sidebar (200px) and main content area.
   Sidebar links (plain <a> tags, no router tricks):
     / admin/dashboard — Dashboard
     /admin/sessions — Sessions
     /admin/questions — Questions
     /admin/escalations — Escalations
     /admin/users — Users
     /admin/costs — Costs

2. Create app/(admin)/dashboard/page.tsx:
   Server component. All fetches in Promise.all — never sequential.
   Metrics grid (6 cards):
     - Active students today
     - Sessions today
     - Cost today (latest DailyCostMetric)
     - Open escalations (DoubtEscalation WHERE resolvedAt IS NULL)
     - Quarantined questions (Question WHERE status = QUARANTINED)
     - Unresolved safety events (SafetyEvent WHERE resolvedAt IS NULL)
   Each card: number in large text, label below, error boundary (shows "—" on error).

3. Create app/(admin)/sessions/page.tsx:
   Fetches GET /api/admin/sessions/sample.
   Table: Date | Student (first 8 chars of ID) | Duration | Turns | Rating | Flag
   Each row has a "View" link that expands turns inline (toggle, no navigation).
   Expanded view: list of turns with role/stage/message (300 chars) + flag form.
   Flag form: select QualityFlag + text note + Submit button.
   On submit: POST /api/admin/sessions/[id]/flag, show success toast.

4. Create app/(admin)/questions/page.tsx:
   Fetches Question WHERE status = QUARANTINED with SessionQuestionFlag count.
   Table: Concept | Question text (80 chars) | Flags | Actions
   Actions: "Approve" → sets status=ACTIVE | "Reject" → sets status=REJECTED
   Both actions write AuditLog entry.
   Empty state: "No quarantined questions — queue is clean ✓"

5. Create app/(admin)/escalations/page.tsx:
   Fetches GET /api/admin/escalations.
   Table: Created | Student (anon) | Concept | Doubt (60 chars) | AI Attempts | Resolve
   Resolve button: inline form with resolution type selector + note input.
   On submit: POST /api/admin/escalations/[id]/resolve.
   Empty state: "No open escalations ✓"

6. Create app/(admin)/costs/page.tsx:
   Fetches last 30 DailyCostMetric rows.
   Simple table: Date | Sessions | Total Cost USD | Cost/Session | Status
   Status: green if cost/session < $0.003, amber 0.003-0.005, red > 0.005.
   Summary row at bottom: 30-day total, average cost/session.

All pages: error boundaries per section, no pagination at MVP.
No mobile CSS needed (admin uses desktop only).

Run npm run build && npm test — report every file created.
```

---

## TASK A10 — Content ingestion pipeline v2

```
/run cat app/api/admin/catalog/parse-pdf/route.ts 2>/dev/null | head -40
/run cat scripts/ingest-curriculum.ts 2>/dev/null | head -60 || find scripts -name "*ingest*" | head -5
/run cat prisma/schema.prisma | grep -A8 "model CurriculumChunk"

Read all files found.

The audit found:
- PDF ingestion endpoint is a stub (logs to console, persists nothing)
- Embedding ingest script exists but has no content hash / versioning
- CurriculumChunk has no contentHash field

PART 1 — Add contentHash to CurriculumChunk:

Add to CurriculumChunk model:
  contentHash  String?
  version      Int      @default(1)
  supersededBy String?  // ID of newer chunk if this one was updated

Add index: @@index([contentHash, subjectId])

Run: /run npx prisma migrate dev --name add_curriculum_chunk_versioning
Run: /run npx prisma generate

PART 2 — Add ingestion run log:

model IngestRunLog {
  id                  String   @id @default(cuid())
  runAt               DateTime @default(now())
  fileSource          String
  board               String
  subjectId           String
  chunksCreated       Int      @default(0)
  chunksUpdated       Int      @default(0)
  embeddingsGenerated Int      @default(0)
  errors              Int      @default(0)
  durationMs          Int      @default(0)
  errorDetails        Json?
}

Run: /run npx prisma migrate dev --name add_ingest_run_log

PART 3 — Harden scripts/ingest-curriculum.ts:

Update the embedding ingest script to:
a) Compute contentHash = SHA256 of chunk text (use Node crypto.createHash)
b) Idempotency: if CurriculumChunk row with same contentHash exists → skip (no re-embed)
   If chunk content changed (different hash, same position): update row + re-embed + increment version
c) Write IngestRunLog row at end of each run with full stats
d) Add --retry-failed flag:
   node scripts/ingest-curriculum.ts --retry-failed --run-id <id>
   Finds chunks from that run that have no embedding → re-attempts embedding only

PART 4 — Fix the PDF ingestion endpoint:

In app/api/admin/catalog/parse-pdf/route.ts:
Replace the stub with a real pipeline:
  1. Accept multipart form upload (pdf file + metadata: board, subjectId, grade, language)
  2. Extract text using pdf-parse (already a dependency — check package.json)
  3. Chunk text: split at ~500 tokens (approx 400 words) with 50-word overlap
     Use simple word-count splitting — no external library needed
  4. For each chunk:
     - Compute contentHash
     - Upsert CurriculumChunk: if contentHash exists → skip; else insert with embedding=null
  5. Enqueue embedding generation (do not block the HTTP response on embedding):
     - Set a Redis key: ingest:pending:{subjectId} = count of chunks needing embedding
     - The existing ingest-curriculum.ts script can be run separately to generate embeddings
       (or trigger it as a background job)
  6. Write IngestRunLog row
  7. Return: { ok: true, chunksCreated: N, chunksSkipped: N, embeddingsPending: N }

Note: embedding generation is async and separate — this endpoint only persists the chunks.
Admin runs ingest-curriculum.ts separately to generate embeddings for pending chunks.

Run npm run build && npm test — report every file changed.
```

---

## EXECUTION ORDER

```
A2 — Fix admin grade backdoor + harden AuditLog schema  ← DO FIRST (security fix)
A3 — Wire question flagging + auto-quarantine
A4 — Admin CLI scripts
A5 — Doubt escalation queue
A6 — Session quality sampling
A7 — Cost anomaly detection (rolling average)
A8 — DPDP right-to-erasure
A9 — Minimal admin web UI  ← depends on A3/A5/A6 APIs existing
A10 — Content ingestion v2  ← can run parallel to A2-A8
```

## GATE BETWEEN EVERY TASK

```bash
npm run build:workers && npm run build && npm test
All green → commit → next task
```

## WHAT IS COMPLETE AFTER ALL 9 TASKS

Operations:
✅ Grade backdoor fixed — all grade changes audited
✅ AuditLog hardened — entityType, entityId, before/after, all admin actions
✅ Question flagging + auto-quarantine (3 flags → QUARANTINED)
✅ Doubt escalation queue + trending alerts
✅ Admin CLI: suspend, reactivate, grade change, diagnostic reset, subscription extend
✅ DPDP right-to-erasure (7-day pseudonymise, 30-day PII purge)
✅ Session quality sampling tool
✅ Cost anomaly detection — rolling average + cache hit rate
✅ Minimal admin web UI
✅ Content ingestion hardened — hash versioning, IngestRunLog, real PDF endpoint

Still deferred (Phase 2 admin — after 10K students):

- Full admin dashboard UI (F-ADM-P2-001)
- Content management UI (F-ADM-P2-002)
- A/B test framework
- Cohort retention analysis
- Bulk institutional onboarding

---

## AUDIT FINDINGS — V1 CONTENT PIPELINE STATE

Before tasks begin, here is what exists vs what v2 requires:

### What v1 has (working):

- HydrationJob + ExecutionJob BullMQ pipeline for content generation
- AIContentLog for every LLM call (model, tokens, costUsd, promptType)
- GeneratedTest + GeneratedQuestion tables
- CLI ingestion pipeline: PDF → chunks → embeddings → pgvector
- SystemMetricSample telemetry tables
- Basic profanity guard on student input

### What v1 is missing vs v2 spec:

- No unified session_turns schema for daily quality sampling
- No SafetyEvent pipeline for tutoring (only content generation)
- No automated quarantine trigger (3 flags → QUARANTINED not wired end-to-end)
- No question bank health report (weekly email)
- No doubt escalation queue (F-ADM-011)
- No admin CLI scripts for: grade change, diagnostic reset, account suspension
- No audit_log table for admin actions
- No cost anomaly detection (1.5x rolling average alert)
- No DPDP right-to-erasure workflow
- Hallucination/groundedness logging not wired to tutor sessions

---

## TASK A1 — Audit: map v1 content pipeline to v2 requirements

```
/run find worker/services worker/processors lib/content -type f -name "*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find scripts -type f -name "*.ts" -o -name "*.cjs" -o -name "*.js" 2>/dev/null | grep -v node_modules | head -20
/run grep -rn "HydrationJob\|ExecutionJob\|contentWorker\|CONTENT_HYDRATION" worker/ lib/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20
/run cat prisma/schema.prisma | grep -A3 "model GeneratedQuestion\|model GeneratedTest\|model HydrationJob\|model AIContentLog" | head -60

Read all files found. This is an audit task — do NOT make any code changes.

Produce a structured report covering:

1. CONTENT GENERATION PIPELINE
   - What queues exist and what each one does
   - What workers consume each queue
   - What the full lifecycle of a HydrationJob is (created → processed → completed/failed)
   - What content gets generated (notes? questions? tests? embeddings?)
   - What triggers content generation (CLI script? API call? scheduled job?)

2. QUESTION BANK STATE
   - Schema of GeneratedQuestion: what fields exist
   - What quality gates exist at generation time
   - Whether Question model and GeneratedQuestion are the same or different
   - How questions currently get from GeneratedQuestion into the AI tutor session flow

3. GAP ANALYSIS
   For each item below, state: PRESENT / PARTIAL / MISSING and where the code is (if present):
   - PDF ingestion CLI
   - Chunk versioning (idempotent re-ingest)
   - Concept taxonomy seeding scripts
   - Question flagging (student flags a question)
   - QuestionFlag → QUARANTINED status (3 flags trigger)
   - Question bank health report
   - Doubt escalation queue
   - Session quality sampling (random 10 sessions/day)
   - Admin grade change with audit log
   - Admin diagnostic reset
   - Account suspension/deactivation
   - DPDP right-to-erasure workflow
   - Audit log table (all admin actions)
   - Cost anomaly detection (1.5x rolling average)

4. V2 READINESS VERDICT
   For each of the 4 content pipeline components (ingestion, question bank,
   quality monitoring, admin operations): rate as:
   - READY (works for v2 as-is)
   - NEEDS WIRING (code exists, not connected)
   - NEEDS BUILDING (does not exist)

Do not change any files. Output the report only.
```

---

## TASK A2 — Wire question flagging and quarantine

```
/run grep -rn "QuestionFlag\|QUARANTINED\|flag.*question\|question.*flag" prisma/schema.prisma lib/ app/ --include="*.ts" --include="*.tsx" --include="*.prisma" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20
/run find app/api -path "*question*" -o -path "*flag*" 2>/dev/null | grep -v node_modules | head -10

Read all files found. This task wires the full question flagging pipeline.

1. Check if QuestionFlag model exists in prisma/schema.prisma.
   If not, add:

model QuestionFlag {
  id          String      @id @default(cuid())
  questionId  String
  studentId   String
  reason      FlagReason
  details     String?
  createdAt   DateTime    @default(now())
  question    Question    @relation(fields: [questionId], references: [id])
  student     User        @relation(fields: [studentId], references: [id])
  @@unique([questionId, studentId])
  @@index([questionId])
}

enum FlagReason {
  WRONG_ANSWER
  AMBIGUOUS
  TYPO
  OFF_TOPIC
  TOO_EASY
  TOO_HARD
}

Add quarantined status to Question if not present:
  status  QuestionStatus  @default(ACTIVE)

enum QuestionStatus {
  ACTIVE
  QUARANTINED
  REJECTED
  PENDING_REVIEW
}

Run: /run npx prisma migrate dev --name add_question_flag_quarantine
Run: /run npx prisma generate

2. Create app/api/student/question/[questionId]/flag/route.ts (POST):
   - Auth-guarded (student role only)
   - Body: { reason: FlagReason, details?: string }
   - Upsert QuestionFlag (one flag per student per question)
   - After upsert: count total flags for this question
   - If count >= 3: update Question.status = QUARANTINED
   - Quarantined questions excluded from all serving queries — add
     status: 'ACTIVE' filter to every prisma.question.findMany() call
     in the codebase (grep first, then add filter)
   - Return: { flagged: true, totalFlags: number }

3. In the AI tutor chat (wherever questions are served to students):
   - Add a small "Flag this question" button (text link, not prominent)
   - On tap: POST /api/student/question/[questionId]/flag
   - On success: show "Thanks for the feedback" toast — no disruption to session
   - Never block the session flow on flag submission

4. Create a nightly job in worker/services/questionHealthWorker.ts:
   Schedule: every Monday at 07:00 IST (cron '30 1 * * 1')
   Query:
     - Concepts with < 5 ACTIVE questions: alert
     - Quarantined questions count by subject
     - Questions with validation_rate < 50% (if IRT validation tracking exists)
   Send weekly health report email to ONCALL_EMAIL:
     Subject: "Spinzy question bank health — week of [date]"
     Body: concepts with low question count, quarantined count, action items

Run npm run build:workers && npm run build && npm test
```

---

## TASK A3 — Doubt escalation queue

```
/run grep -rn "escalation\|Escalation\|doubt.*fail\|failed.*doubt\|3.*attempt" lib/ app/ worker/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20
/run grep -rn "DoubtKb\|doubtKb\|recordDoubt" lib/ services/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -10

Read all files found. This task builds the doubt escalation pipeline.

When the AI fails to resolve a student doubt after 3 consecutive turns
(student asks the same concept question 3 times without the AI marking it
resolved), escalate to admin review.

1. Add to prisma/schema.prisma:

model DoubtEscalation {
  id            String   @id @default(cuid())
  studentId     String
  sessionId     String
  conceptId     String?
  doubtText     String
  aiAttempts    Json     // Array of { turnId, aiResponse } — last 3 attempts
  resolvedAt    DateTime?
  resolutionType String? // 'chunk_updated' | 'misconception_added' | 'prompt_fix' | 'cached_answer'
  resolutionNote String?
  createdAt     DateTime @default(now())
  student       User     @relation(fields: [studentId], references: [id])
  @@index([resolvedAt, createdAt])
}

Run: /run npx prisma migrate dev --name add_doubt_escalation
Run: /run npx prisma generate

2. In the AI tutor orchestrator (services/tutor/turn.ts):
   Track consecutive doubt turns per session in Redis:
   Key: session:{sessionId}:doubt_attempts:{doubtHash}
   where doubtHash = first 8 chars of SHA256 of conceptId + student message
   TTL: 3600s

   On each doubt-type turn:
   - INCR the counter
   - If counter reaches 3:
     - Create DoubtEscalation row with last 3 turn contexts
     - Reset counter
     - Log event: 'doubt_escalated'

3. Create app/api/admin/escalations/route.ts (GET):
   - Admin role only (check session.user.role === 'admin')
   - Returns unresolved DoubtEscalation rows ordered by createdAt
   - Query: WHERE resolvedAt IS NULL ORDER BY createdAt ASC
   - Returns: { escalations: DoubtEscalation[], count: number }

4. Create app/api/admin/escalations/[id]/resolve/route.ts (POST):
   - Admin role only
   - Body: { resolutionType, resolutionNote }
   - Sets resolvedAt + resolutionType + resolutionNote
   - Returns: { resolved: true }

5. Add trending escalation alert to the nightly cost report job (Task 18):
   If same conceptId escalated by > 5 different students in last 7 days:
   Add to the cost report email: "⚠️ Trending doubt: [conceptName] — N escalations this week"

Run npm run build:workers && npm run build && npm test
```

---

## TASK A4 — Admin CLI scripts for user operations

```
/run find scripts -type f \( -name "*.ts" -o -name "*.cjs" -o -name "*.js" \) 2>/dev/null | grep -v node_modules | head -20
/run grep -rn "suspend\|deactivate\|grade.*change\|diagnostic.*reset\|admin.*action" lib/ app/api/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20
/run cat prisma/schema.prisma | grep -A5 "model AuditLog\|model AdminAction\|auditLog" | head -20

Read all files found. This task builds the admin CLI toolkit.

1. Add AuditLog model to prisma/schema.prisma if not present:

model AuditLog {
  id             String   @id @default(cuid())
  adminId        String
  actionType     AdminActionType
  targetEntity   String   // 'User' | 'Question' | 'Subscription' etc
  targetId       String
  previousValue  Json?
  newValue       Json?
  reason         String?
  ipAddress      String?
  createdAt      DateTime @default(now())
  admin          User     @relation(fields: [adminId], references: [id])
  @@index([targetEntity, targetId])
  @@index([createdAt])
}

enum AdminActionType {
  GRADE_CHANGE
  DIAGNOSTIC_RESET
  ACCOUNT_SUSPEND
  ACCOUNT_DEACTIVATE
  SUBSCRIPTION_EXTEND
  SUBSCRIPTION_REFUND
  QUESTION_QUARANTINE
  QUESTION_APPROVE
  FEATURE_FLAG_CHANGE
  DATA_ERASURE_REQUEST
}

Run: /run npx prisma migrate dev --name add_audit_log
Run: /run npx prisma generate

2. Create scripts/admin.cjs — a single multi-command admin CLI:

Usage examples:
  node scripts/admin.cjs suspend-user --userId <id> --reason "Policy violation"
  node scripts/admin.cjs unsuspend-user --userId <id>
  node scripts/admin.cjs change-grade --userId <id> --grade 11 --reason "Student transferred board"
  node scripts/admin.cjs reset-diagnostic --userId <id> --subjectId <id> --reason "Student changed medium"
  node scripts/admin.cjs extend-subscription --userId <id> --days 30 --reason "Technical issue"
  node scripts/admin.cjs list-escalations
  node scripts/admin.cjs list-quarantined-questions
  node scripts/admin.cjs view-audit-log --userId <id>

Each command must:
  - Read DATABASE_URL from .env.production or env
  - Prompt for confirmation before any write: "Are you sure? (yes/no)"
  - Write an AuditLog row for every write action
  - Log the result clearly: "✅ Done: [action] on [entity]"
  - Never throw without a clear error message

Implement at minimum:
  - suspend-user: set User.accountStatus = 'suspended'
  - unsuspend-user: set User.accountStatus = 'active'
  - change-grade: update User.grade, reset StudentConceptState for affected subjects,
    log to AuditLog with previousGrade + newGrade
  - reset-diagnostic: delete StudentConceptState rows for studentId + subjectId,
    delete LearningPlan for studentId + subjectId,
    log to AuditLog
  - extend-subscription: update Subscription.expiresAt += N days, log to AuditLog
  - list-escalations: print unresolved DoubtEscalation rows
  - list-quarantined-questions: print Question rows where status = QUARANTINED
  - view-audit-log: print last 20 AuditLog rows for a user

Run npm run build && npm test
```

---

## TASK A5 — DPDP right-to-erasure workflow

```
/run grep -rn "erasure\|deletion\|DPDP\|rightToErasure\|deleteUser\|purge" lib/ app/api/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20
/run find app/api/admin -type f 2>/dev/null | grep -v node_modules
/run find app/\(student\)/profile -type f 2>/dev/null | grep -v node_modules

Read all files found. This task implements the DPDP right-to-erasure workflow.

Under DPDP 2023, students/parents can request data deletion. The process:
- Account deactivated immediately
- Data pseudonymised within 7 days
- PII purged within 30 days
- Audit log retained 7 years

1. Create app/api/student/account/deletion-request/route.ts (POST):
   - Auth-guarded
   - Creates a DeletionRequest row (add model to schema below)
   - Deactivates account immediately: User.accountStatus = 'deletion_pending'
   - Sends confirmation email to student/parent
   - Returns: { requested: true, scheduledPurgeDate: Date }

Add to prisma/schema.prisma:
model DeletionRequest {
  id                String    @id @default(cuid())
  userId            String    @unique
  requestedAt       DateTime  @default(now())
  pseudonymisedAt   DateTime?
  purgedAt          DateTime?
  retainedForLegal  Boolean   @default(true) // audit logs retained 7 years
  user              User      @relation(fields: [userId], references: [id])
}

Run: /run npx prisma migrate dev --name add_deletion_request

2. Create worker/services/dataDeletionWorker.ts:
   BullMQ job, runs nightly at 02:00 IST (cron '30 20 * * *')

   Phase 1 — Pseudonymise (runs if requestedAt > 7 days ago, pseudonymisedAt IS NULL):
     - Replace User.name with 'Deleted User'
     - Replace User.email with deleted_{id}@deleted.spinzy.com
     - Replace User.phone with null
     - Replace User.age with null
     - Keep all learning data (masteryScore, sessions) for platform analytics — anonymised
     - Set DeletionRequest.pseudonymisedAt = now()

   Phase 2 — Purge PII (runs if pseudonymisedAt > 30 days ago, purgedAt IS NULL):
     - Delete Consent rows
     - Delete ParentStudent rows
     - Delete ParentProfile rows
     - Nullify AITutorTurnLog.studentMessage (replace with '[PURGED]')
     - Set DeletionRequest.purgedAt = now()
     - Log to AuditLog: actionType = DATA_ERASURE_REQUEST

   Never delete: AuditLog rows, StructuredSession rows (anonymised), DailyCostMetric

3. Add "Delete my account" button to student profile settings page
   (wherever app/(student)/profile exists or create app/(student)/profile/page.tsx):
   - Under "Privacy & Data" section
   - Shows warning: "This will delete your account and all personal data within 30 days.
     Your learning progress will be anonymised and retained for platform improvement."
   - Requires confirmation: type "DELETE" to confirm
   - POST /api/student/account/deletion-request on confirm

Run npm run build:workers && npm run build && npm test
```

---

## TASK A6 — Session quality sampling for admin

```
/run grep -rn "AITutorTurnLog\|session_turns\|sessionTurn\|qualityFlag\|quality_flag" prisma/schema.prisma lib/ app/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | head -20
/run find app/api/admin -type f 2>/dev/null | grep -v node_modules

Read all files found. This task wires session quality review for the admin.

1. Check if AITutorTurnLog has a qualityFlag field. If not, add to schema:
   qualityFlag  QualityFlag?
   qualityNote  String?

enum QualityFlag {
  HALLUCINATION
  INCORRECT_EXPLANATION
  POOR_PEDAGOGY
  OFF_TOPIC
  SAFETY_CONCERN
  DIRECT_ANSWER_GIVEN
}

Run: /run npx prisma migrate dev --name add_quality_flag_to_turn_log

2. Create app/api/admin/sessions/sample/route.ts (GET):
   - Admin role only
   - Returns 10 random sessions from yesterday with their turns
   - Query:
     SELECT s.id, s.studentId, s.startedAt, s.completedAt,
            COUNT(t.id) as turnCount
     FROM StructuredSession s
     JOIN AITutorTurnLog t ON t.sessionId = s.id
     WHERE s.startedAt >= yesterday 00:00 IST
     GROUP BY s.id
     ORDER BY RANDOM() LIMIT 10
   - For each session: include first 5 turns (role + message + tags)
   - Returns: { sessions: SessionSample[], date: string }

3. Create app/api/admin/sessions/[sessionId]/flag/route.ts (POST):
   - Admin role only
   - Body: { turnId: string, flag: QualityFlag, note: string }
   - Updates AITutorTurnLog.qualityFlag + qualityNote
   - Creates AuditLog entry
   - Returns: { flagged: true }

4. Create scripts/quality-sample.cjs:
   node scripts/quality-sample.cjs
   - Fetches 10 random sessions from yesterday
   - Prints each session: studentId (anonymised), duration, turn count
   - Prints first 3 AI turns per session (role: AI, message truncated to 200 chars)
   - Prints prompt: "Flag any turn? Enter sessionId:turnId:flagType or press Enter to skip"
   - On flag entry: calls the admin API or directly updates the DB
   - This is the daily manual review tool — run every morning

5. Add to the weekly cost email (Task 18 / costReportingWorker):
   - Include: avg session rating from last 7 days (from session rating table)
   - Include: count of quality flags by type this week
   - Include: count of DIRECT_ANSWER_GIVEN flags (critical — violates core rule)

Run npm run build:workers && npm run build && npm test
```

---

## TASK A7 — Cost anomaly detection

```
/run cat worker/services/costReportingWorker.ts 2>/dev/null | head -60
/run grep -rn "DailyCostMetric\|costPerSession\|rollingAverage" lib/ worker/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -10

Read all files found. This task adds anomaly detection to the cost reporting worker.

In worker/services/costReportingWorker.ts, after computing today's costPerSession:

1. Load last 7 days of DailyCostMetric rows:
   const last7Days = await prisma.dailyCostMetric.findMany({
     where: { date: { gte: sevenDaysAgo } },
     orderBy: { date: 'desc' },
     take: 7,
   })

2. Compute rolling 7-day average:
   const rolling7DayAvg = last7Days.length > 0
     ? last7Days.reduce((sum, d) => sum + d.costPerSession, 0) / last7Days.length
     : 0

3. Anomaly conditions — send alert if ANY of these are true:
   - costPerSession > rolling7DayAvg * 1.5  (50% above rolling average)
   - totalCostUsd > 200  (USD hard ceiling per day — absolute budget guard)
   - sessions > 0 && costPerSession > 0.003  (existing per-session alert)
   - sessions === 0 && previousDay.sessions > 10  (sudden drop — likely an outage)

4. Alert email should include:
   - Today's cost per session vs 7-day average
   - % change
   - Total cost USD
   - Sessions count
   - Which anomaly condition triggered
   - Link to Neon console with pre-written query to investigate

5. Add cache hit rate to the report:
   Query AITutorTurnLog:
   SELECT
     COUNT(*) FILTER (WHERE cached = true)::float / COUNT(*) as cacheHitRate,
     COUNT(*) as totalTurns,
     COUNT(DISTINCT sessionId) as sessions
   FROM AITutorTurnLog
   WHERE createdAt >= yesterday 00:00 IST

   If cacheHitRate < 0.55 (55% target): add warning to email.
   "⚠️ Cache hit rate: N% (target >55%) — investigate explanation cache invalidation"

Run npm run build:workers && npm run build && npm test
```

---

## TASK A8 — Admin dashboard: minimal read-only web UI

```
/run find app/\(admin\) app/admin -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components/admin -type f 2>/dev/null | grep -v node_modules
/run grep -rn "role.*admin\|admin.*role\|isAdmin" app/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -10

Read all files found.

NOTE: The v2 spec says "Zero admin UI at MVP — revisit when > 10,000 active students or > 5 team members."
This task builds only the MINIMUM admin UI needed for daily operations.
No complex UI — simple tables with read-only data and a few action buttons.

1. Create app/(admin)/layout.tsx:
   - Server component
   - requireActiveSession() → if no session or role !== 'admin' → redirect('/login')
   - Simple sidebar: Dashboard | Sessions | Questions | Escalations | Users | Costs
   - No mobile responsiveness needed (admin uses desktop)

2. Create app/(admin)/dashboard/page.tsx:
   Server component showing today's key metrics in a simple grid:
   - Active students today (COUNT DISTINCT from sessions)
   - Sessions today
   - Cost today (from DailyCostMetric)
   - Open escalations count
   - Quarantined questions count
   - Safety events unresolved count
   All fetched in Promise.all, each card has an error boundary.

3. Create app/(admin)/sessions/page.tsx:
   - Fetches GET /api/admin/sessions/sample
   - Simple table: Date | Student (anonymised ID) | Duration | Turns | Rating | Actions
   - "Flag" button on each row → opens a simple form: select flag type + note
   - "View full session" → shows all turns in a scrollable div

4. Create app/(admin)/escalations/page.tsx:
   - Fetches GET /api/admin/escalations
   - Table: Created | Student (anon) | Concept | Doubt text (truncated) | AI Attempts | Actions
   - "Resolve" button → inline form: resolution type + note → POST /resolve

5. Create app/(admin)/questions/page.tsx:
   - Fetches quarantined questions: prisma.question.findMany({ where: { status: 'QUARANTINED' } })
   - Table: Concept | Question text | Flags count | Actions
   - "Approve" button → sets status = ACTIVE
   - "Reject" button → sets status = REJECTED

All pages:
  - Server components where possible
  - No Tailwind animations — plain functional UI
  - Error states: each section fails independently
  - No pagination needed at MVP (< 10K students means < 100 rows per table)

Run npm run build && npm test
```

---

## TASK A9 — Content ingestion pipeline v2 readiness

```
/run find scripts -name "*ingest*" -o -name "*seed*" -o -name "*curriculum*" 2>/dev/null | grep -v node_modules | head -10
/run cat scripts/ingest-curriculum.ts 2>/dev/null | head -60 || find scripts -name "*.ts" | head -5
/run grep -rn "CurriculumChunk\|embedding\|pgvector\|ingest" scripts/ lib/ --include="*.ts" --include="*.cjs" 2>/dev/null | grep -v node_modules | head -20

Read all files found. This task verifies and hardens the content ingestion pipeline.

1. AUDIT the existing ingest-curriculum.ts (or equivalent):
   Check if it:
   - Accepts: --file, --board, --subject, --grade, --lang flags
   - Chunks text at ~500 tokens with 50-token overlap
   - Tags each chunk with: board, subjectId, chapterId, conceptIds[]
   - Generates embeddings via text-embedding-3-small
   - Is idempotent (re-running does not create duplicates)
   - Logs a summary: chunks_created, chunks_updated, embeddings_generated, errors

   If any of these are missing, add them. Do not change working behaviour.

2. VERIFY idempotency:
   The upsert logic should use a unique constraint on (contentHash, subjectId):
   - contentHash = SHA256 of the raw chunk text
   - On re-ingest: if hash matches → update embedding only if chunk was edited
   - If hash differs → create new chunk version, mark old as superseded

   Check if CurriculumChunk has contentHash field. If not, add:
   contentHash  String?
   @@index([contentHash, subjectId])
   Migration: add_curriculum_chunk_content_hash

3. ADD --retry-failed flag:
   node scripts/ingest-curriculum.cjs --retry-failed --run-id <id>
   - Look up chunks that failed embedding in a given ingest run
   - Re-attempt embedding generation for failed chunks only
   - Log results

4. VERIFY concept taxonomy seeding is documented:
   There should be a script or migration that seeds:
   BoardDef → SubjectDef → ChapterDef → TopicDef → Concept hierarchy

   Run: /run find scripts -name "*taxonomy*" -o -name "*seed*concept*" 2>/dev/null | grep -v node_modules

   If no taxonomy seeding script exists: create scripts/seed-taxonomy.cjs with
   instructions at the top explaining the manual steps needed before ingestion.

5. ADD ingestion run log:
   After each ingest run, write a row to a simple IngestRunLog table:

model IngestRunLog {
  id                  String   @id @default(cuid())
  runAt               DateTime @default(now())
  fileSource          String
  board               String
  subjectId           String
  chunksCreated       Int      @default(0)
  chunksUpdated       Int      @default(0)
  embeddingsGenerated Int      @default(0)
  errors              Int      @default(0)
  durationMs          Int      @default(0)
  errorDetails        Json?
}

   Migration: add_ingest_run_log

Run npm run build && npm test
```

---

## EXECUTION ORDER

```
A1 — Audit (read-only — do first, informs all other tasks)
A2 — Question flagging + quarantine
A3 — Doubt escalation queue
A4 — Admin CLI scripts
A5 — DPDP right-to-erasure
A6 — Session quality sampling
A7 — Cost anomaly detection
A8 — Minimal admin web UI (do last — depends on A2-A6 APIs)
A9 — Content ingestion v2 hardening (can run parallel to A2-A7)
```

## GATE BETWEEN EVERY TASK

```bash
npm run build:workers && npm run build && npm test
All green → commit → next task
```

## WHAT THIS COVERS AFTER ALL 9 TASKS

Operations:
✅ Question flagging + auto-quarantine (3 flags)
✅ Doubt escalation queue + trending alerts
✅ Admin CLI for user ops (suspend, grade change, diagnostic reset)
✅ DPDP right-to-erasure (7-day pseudonymise, 30-day PII purge)
✅ Session quality sampling tool (daily manual review)
✅ Cost anomaly detection (1.5x rolling average + cache hit rate)
✅ Minimal admin web UI (sessions, escalations, quarantined questions)
✅ Content ingestion pipeline hardened + idempotent

Still deferred (Phase 2 admin — after 10K students):

- Full admin dashboard UI (F-ADM-P2-001)
- Content management UI (F-ADM-P2-002)
- A/B test framework (F-ADM-P2-003)
- Cohort retention analysis (F-ADM-P2-004)
- Bulk institutional onboarding (F-ADM-P2-005)
