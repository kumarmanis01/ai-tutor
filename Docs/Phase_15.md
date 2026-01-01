Excellent — Phase 15 is the last irreversible step in your system, so it must be governed, explicit, and boringly safe.

Below is a complete, production-grade Phase 15 design, followed by section-wise Copilot prompts exactly in the format that works (small, sequential, non-hallucinating).

I’ve structured this so you can:

Put the Phase 15 document into the repo

Then run Copilot prompts one section at a time

📘 PHASE 15 — OUTPUT PROMOTION & SAFE PUBLISHING
Phase 15 Purpose (What & Why)
Problem this phase solves

Until now:

Regeneration outputs exist
They are immutable
They are auditable
But nothing connects them to learner-visible content
Phase 15 introduces a human-governed promotion layer that decides:
“Which output is the official, published version learners see?”

Without:
Mutating historical data
Overwriting previous outputs
Allowing generators or workers to publish directly
Core Principles (Non-Negotiable)
No mutation
Old outputs are never modified
No auto-promotion
Humans must approve
Exactly one ACTIVE output per scope
Promotion is reversible
By promoting another output (never rollback/mutate)
Learner APIs only read ACTIVE outputs
Audit everything

High-Level Flow
RegenerationOutput (immutable)
        ↓
PromotionCandidate (admin-visible)
        ↓
PromotionDecision (approve/reject)
        ↓
PublishedOutput (ACTIVE pointer)
        ↓
Learner APIs consume ONLY this

🧱 DATA MODEL (Prisma)
15.1 New Enums
enum PromotionStatus {
  PENDING
  APPROVED
  REJECTED
}

enum PublishScope {
  COURSE
  MODULE
  LESSON
}

15.2 New Models
PromotionCandidate
model PromotionCandidate {
  id                String   @id @default(cuid())
  scope             PublishScope
  scopeRefId        String   // courseId / lessonId etc
  regenerationJobId String
  outputRef         String   // immutable pointer
  status            PromotionStatus @default(PENDING)

  createdBy         String
  createdAt         DateTime @default(now())

  reviewedBy        String?
  reviewedAt        DateTime?
  reviewNotes       Json?

  @@index([scope, scopeRefId])
  @@unique([scope, scopeRefId, outputRef])
}

PublishedOutput (The “Pointer” Model)
model PublishedOutput {
  id          String   @id @default(cuid())
  scope       PublishScope
  scopeRefId  String
  outputRef   String

  promotedBy  String
  promotedAt  DateTime @default(now())

  @@unique([scope, scopeRefId])
}


Important:
This guarantees exactly one ACTIVE output per scope.

🔐 SAFETY INVARIANTS
Rule	Enforcement
One active output	DB unique constraint
No mutation	Insert-only models
No auto publish	Admin-only APIs
Reversible	Promote another output
Learners see only approved	Guarded read APIs
Auditable	Audit events on every action
## 🧠 PHASE 15 SUB-PHASES
Sub-Phase	Purpose
15.1	Prisma schema & migration
15.2	Promotion store/service
15.3	Admin APIs
15.4	Admin UI
15.5	Learner read guards
15.6	Audit & tests


🤖 COPILOT PROMPTS (RUN IN ORDER)

⚠️ IMPORTANT
Run one prompt at a time
Commit after each sub-phase

### 🧩 15.1 — Prisma Schema & Migration
Copilot Prompt — Phase 15.1

Add Prisma schema for Phase 15 output promotion.
Tasks:

Add enums:
PromotionStatus (PENDING, APPROVED, REJECTED)
PublishScope (COURSE, MODULE, LESSON)

Add models:
PromotionCandidate
PublishedOutput

Enforce:
One PublishedOutput per (scope, scopeRefId)
PromotionCandidate is insert-only

Generate migration:
npx prisma migrate dev --name add_output_promotion
Run prisma generate.

Do NOT modify existing models.

### 🧩 15.2 — Promotion Store & Service
Purpose
Encapsulate promotion logic outside APIs.

Copilot Prompt — Phase 15.2
Implement promotion store and service.
Files:
lib/promotion/store.ts
lib/promotion/service.ts

Store responsibilities:
createPromotionCandidate()
listCandidatesByScope()
getCandidateById()

Service responsibilities:
approveCandidate():
transaction
insert PublishedOutput
update candidate status to APPROVED
rejectCandidate()

Rules:
Cannot approve twice
Cannot approve rejected
PublishedOutput replaces previous ACTIVE by unique constraint
No deletes

Add unit tests for idempotency and conflicts.

### 🧩 15.3 — Admin APIs

Copilot Prompt — Phase 15.3
Add admin-only APIs for output promotion.
Routes:
POST /api/admin/promotions/candidates
GET /api/admin/promotions?scope=&refId=
POST /api/admin/promotions/:id/approve
POST /api/admin/promotions/:id/reject

Requirements:
Admin-guarded
No generator imports
Call promotion service only

Emit audit events:
PROMOTION_CANDIDATE_CREATED
PROMOTION_APPROVED
PROMOTION_REJECTED

Add API tests enforcing:
No double approve
No learner access

### 🧩 15.4 — Admin UI
Pages
Page	Route
Candidate List	/admin/promotions
Candidate Detail	/admin/promotions/[id]

Copilot Prompt — Phase 15.4
Implement admin UI for output promotion.
Pages:
List page:
filter by scope
status badge

Detail page:
ReadOnlyJsonViewer for outputRef
Approve / Reject buttons

UI Rules:
No editing JSON
Confirm dialogs
Disable actions once decided

Use existing ReadOnlyJsonViewer.

### 🧩 15.5 — Learner Read Guards
Purpose

Learners only see PublishedOutput.

Copilot Prompt — Phase 15.5
Update learner content read paths.
Tasks:
Before returning content:
Resolve PublishedOutput by scope + refId
If none exists:
Return 404 or “not published”
Load content via outputRef only

Add tests:

Learner cannot access unapproved output

Switching promotion switches learner-visible content

### 🧩 15.6 — Audit + Tests

Copilot Prompt — Phase 15.6

Add audit and regression tests for Phase 15.

Tasks:
Emit audit logs for:
candidate create
approve
reject

Add invariant tests:
Only one PublishedOutput per scope
Old outputs untouched
Promotion is reversible by replacement

Ensure full test suite passes.

### ✅ PHASE 15 DONE WHEN
- Prisma migration applied
- Admin can promote outputs
- Learners see only ACTIVE output
- Promotion is auditable
- Old outputs preserved
- Tests enforce invariants