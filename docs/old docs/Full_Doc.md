# Phase 6 — AI Syllabus & Curriculum Engine

## 1️⃣ Phase 6 Design Document

Purpose: Build the AI Syllabus Engine — the brain that converts a learning intent into a structured, reviewable, versioned syllabus.

What Phase 6 builds

- A deterministic syllabus generator that turns high-level inputs into a structured JSON syllabus.
- Human-reviewable and versioned artifacts that are safe to approve before content generation.

This phase answers: “What should the learner learn, in what order, and to what depth?” — it maps the curriculum, it does not create lesson content.

### Why Phase 6 exists

Most AI content systems fail because they:

- Jump directly to content generation
- Produce verbose but unstructured lessons
- Cannot guarantee coverage, progression, or outcomes

Phase 6 introduces:

- Deterministic structure
- Pedagogical sequencing
- Human-reviewable outputs
- AI controllability

### What Phase 6 deliberately excludes

- Video generation
- Slides
- Quizzes (detailed assessments)
- Infra scaling / production Kubernetes
- LMS integrations

Those belong to later phases (7–9).

### Core goals of Phase 6

Goal — Meaning

- **Structured output:** JSON syllabus, not prose
- **Deterministic:** Same input → similar structure
- **Reviewable:** Humans can approve / edit
- **Versioned:** Syllabus is immutable once approved
- **AI-agnostic:** Works with GPT, Claude, etc.

## 2️⃣ Phase 6 Inputs → Outputs

Inputs

- Course title
- Target audience
- Skill level
- Time budget
- Teaching style
- Constraints (exam-focused, project-based, practical, etc.)

Outputs

- Course syllabus JSON
- Modules
- Lessons
- Learning objectives per lesson
- Prerequisites
- Estimated effort per lesson/module
- Assessment hooks (placeholders)

## 3️⃣ Outcomes at end of Phase 6

By the end of Phase 6 you will have:

- ✅ A formal syllabus schema (JSON schema)
- ✅ A syllabus generator prompt contract (clear inputs/outputs)
- ✅ An approved syllabus artifact (versioned)
- ✅ Confidence that content generation (Phase 7) will not drift or omit scope

Only after these outcomes are satisfied do we move to Phase 7.

## 4️⃣ Implementation Notes (practical)

- **Schema:** Define a JSON Schema for `Syllabus` with `modules[]`, `lessons[]`, `objectives[]`, `prerequisites`, `estimates`, and `metadata` (version, createdBy, createdAt).
- **Prompt contract:** Single canonical prompt template for syllabus generation. Include explicit instructions about output structure, length limits, and failure modes.
- **Determinism:** Use sampling temperature low (0.0–0.3) and a deterministic post-processor that validates/normalizes the AI output against the JSON Schema.
- **Review flow:** Produce a `draft` artifact stored in DB (or filesystem) with a review URL and version id. After approval, mark `approved` and make the syllabus immutable.
- **Tests:** Unit tests for the prompt→schema validation; integration tests that run a dry-run with a fixed seed or deterministic mock LLM.

## 5️⃣ Developer Tasks (milestones)

1. Define `Syllabus` JSON Schema and store it at `schemas/syllabus.schema.json`.
2. Add `lib/syllabusGenerator.ts` with a function `generateSyllabus(input): Promise<SyllabusDraft>` that calls the LLM and validates output.
3. Add prompt templates under `prompts/syllabus/` with examples.
4. Add integration tests in `tests/phase6/` using a deterministic LLM mock.
5. Add a minimal UI or CLI to view and approve a draft syllabus (can be simple JSON viewer).

## 6️⃣ Running & Validation (local-first)

- Keep the infra frozen: do not unblock on EKS. Use Docker Compose or local processes to run services.
- CI should run `npm test`, `helm lint`, and `helm template` to validate packaging.
- To validate prompts without external LLM costs, provide a `mock-llm` mode that returns deterministic canned responses.

## 7️⃣ Acceptance Criteria

The Phase 6 deliverable is accepted when:

1. There is a valid `Syllabus` JSON Schema.
2. The `generateSyllabus()` function produces schema-compliant drafts for a variety of inputs (unit tests pass).
3. A human reviewer can inspect and approve a syllabus draft via CLI or UI.
4. The approved syllabus is stored with an immutable version id and metadata.

## 8️⃣ Next Steps (Phase 7 preview)

- After approval of the syllabus, Phase 7 will generate lesson content and assessments according to the approved syllabus.
- Phase 7 will also add content moderation, richer prompt chains, and content chunking for downstream features.

---

Place this file at `docs/PHASE_6.md` and use it as the north star for team work on the Syllabus Engine.

# Phase 7 — AI Content Generation Engine (Lessons, Quizzes, Projects)

Principle:
Phase 7 generates content, but never structure.
All structure comes from Phase 6 (Approved Syllabus).

🎯 Phase 7 Goal (What & Why)
What we want to achieve

Transform an APPROVED syllabus into:

- Structured lessons
- Knowledge checks (MCQs)
- Practical assignments / projects

All content must be:

- Schema-validated
- Versioned
- Reviewable
- Regeneratable

Why this phase exists

To prevent:

- Hallucinated lesson structures
- Inconsistent depth
- Non-reviewable AI output
- Content drift over time

🧠 Phase 7 Core Rules (Non-Negotiable)

- No syllabus → no content
- Only APPROVED syllabus can generate content
- Each content type has its own schema
- AI outputs JSON only
- All content is persisted & versioned
- Approval gate before publishing

🧱 Phase 7 Sub-Phases (Execution Order)
Phase 7
├─ 7.1 Lesson Schema
├─ 7.2 Lesson Generator
├─ 7.3 Quiz Schema + Generator
├─ 7.4 Project / Assignment Generator
├─ 7.5 Content Approval Workflow
└─ 7.6 Content Packaging (Course View)

Each sub-phase is independently testable.

🟦 Phase 7.1 — Lesson Schema (FOUNDATION)
🎯 Goal

Define what a lesson is — before generating any content.

Lesson Schema Design

Conceptual model

Course
└─ Module
└─ Lesson
├─ Explanation
├─ Examples
├─ Key Takeaways
├─ Practice Prompt

TypeScript Types

📄 lib/content/lesson/types.ts

```ts
export interface Lesson {
  id: string;
  syllabusId: string;
  moduleId: string;
  lessonIndex: number;

  title: string;
  durationMinutes: number;

  objectives: string[];

  explanation: {
    overview: string;
    concepts: {
      title: string;
      explanation: string;
      example?: string;
    }[];
  };

  keyTakeaways: string[];

  practice: {
    prompt: string;
    expectedOutcome: string;
  };

  metadata: {
    level: 'beginner' | 'intermediate' | 'advanced';
    prerequisites?: string[];
  };
}
```

Zod Schema

📄 lib/content/lesson/schema.ts

```ts
import { z } from 'zod';

export const LessonSchema = z.object({
  id: z.string(),
  syllabusId: z.string(),
  moduleId: z.string(),
  lessonIndex: z.number().int(),

  title: z.string().min(5),
  durationMinutes: z.number().int().min(5),

  objectives: z.array(z.string()).min(1),

  explanation: z.object({
    overview: z.string().min(50),
    concepts: z
      .array(
        z.object({
          title: z.string(),
          explanation: z.string().min(50),
          example: z.string().optional(),
        })
      )
      .min(1),
  }),

  keyTakeaways: z.array(z.string()).min(2),

  practice: z.object({
    prompt: z.string().min(30),
    expectedOutcome: z.string().min(30),
  }),

  metadata: z.object({
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    prerequisites: z.array(z.string()).optional(),
  }),
});
```

🟦 Phase 7.2 — Lesson Generator (Controlled AI)
🎯 Goal

Generate lessons per module from an approved syllabus.

Generator Contract

📄 lib/content/lesson/generator.ts

```ts
generateLessons({
  syllabusId,
  moduleId,
  moduleTitle,
  learningObjectives,
  lessonCount
}) → Lesson[]
```

AI Prompt Rules

- JSON only

- One lesson per response OR batched

- No markdown

- No explanations outside JSON

Prompt Builder

📄 lib/content/lesson/prompt.ts

```ts
export function buildLessonPrompt(input) {
  return `
You are generating structured course lessons.

Rules:
- Output ONLY valid JSON
- Match the provided schema exactly
- Do not add extra fields
- Depth must match professional education quality

Input:
${JSON.stringify(input, null, 2)}

Return an array of Lesson objects.
`;
}
```

Generator Logic

📄 generator.ts

```ts
const raw = await llm.generate(prompt);
const parsed = JSON.parse(raw);
const lessons = parsed.map(validateLesson);
return lessons;
```

Notes:

- Do not implement generation logic yet — this section is the contract and prompt guidance only.

🟦 Phase 7.3 — Quiz Generator

🎯 Goal

Generate MCQs per lesson.

Quiz Schema (Simple & Safe)

```ts
export interface Quiz {
  lessonId: string;
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}
```

Zod enforces:

1. 4 options
2. correctIndex ∈ [0–3]

🟦 Phase 7.4 — Projects / Assignments Generator

🎯 Purpose (Copilot must understand this)

Projects are:

- Practical application of multiple lessons

- NOT quizzes

- NOT free-form text

- Evaluated via a clear rubric

Projects must be:

- Deterministic

- Schema-validated

- Reviewable

- Regeneratable

🧱 Phase 7.4 — Data Model
Conceptual Structure
Course
└─ Module
└─ Project / Assignment
├─ Problem Statement
├─ Constraints
├─ Deliverables
├─ Evaluation Rubric

🔷 Phase 7.5 — Content Approval Workflow (Critical Gate)

🎯 Purpose (Very Important)

Phase 7.5 is the safety gate.

Nothing becomes:

1. Publishable
2. Persistent
3. Visible to users

Unless it is:

1. Explicitly approved
2. Audited
3. Immutable after approval

Notes:

- Approval is an explicit admin action that records `approvedBy`, `approvedAt`, and an immutable snapshot of the content JSON.
- All attempts to modify an `APPROVED` artifact must be rejected; retries should create new draft artifacts instead.
- Every approval action must create an `AuditLog` entry that includes actor, timestamp, entity id, and a brief rationale.
- The UI and API MUST only surface `APPROVED` content to end-users; drafts are visible only to reviewers and admins.

Design Rules (Copilot must obey)

- Lessons, Quizzes, Projects start as `DRAFT`.
- Only `APPROVED` content can be published.
- Approved content is immutable.
- Approval requires: `approver`, `timestamp`, and an optional `note`.
- All approval actions are audited (create `AuditLog` entries including actor, timestamp, entity id, and rationale).

🟦 Phase 7.6 — Course Packaging

Assemble:

Course
├─ Syllabus
├─ Lessons
├─ Quizzes
└─ Projects

No AI here — pure composition.

🧠 Why This Prevents Rework & Tech Debt
Risk How Phase 7 avoids it
AI hallucinations Schema + validation
Content drift Versioning
Inconsistent quality Fixed prompt contracts
Unreviewable output Approval gates
Cost explosions Deterministic generation

**Phase 7 Summary**

- **Goal:** Transform an APPROVED syllabus into validated, versioned, reviewable content (lessons, quizzes, projects) while preventing hallucination, drift, and inconsistent quality.
- **Completed so far:**
  - Formalized Phase 7 design and sub-phases (7.1–7.3)
  - Implemented `Lesson` types and Zod schema (`lib/content/lesson/types.ts`, `schema.ts`) with unit tests
  - Added lesson generator contract, prompt builder, mock LLM adapter, and unit tests (no generation logic that writes data)
  - Implemented Quiz types and Zod schema (`lib/content/quiz/schema.ts`) with generator contract and tests

- **Pending / Next:**
  - Implement Project / Assignment schema and generators (7.4)
  - Implement approval workflow for generated content (7.5) including audit logs and `approvedBy` metadata
  - Course packaging logic (7.6) and UI/CLI to assemble and publish packages
  - Integration tests connecting Phase 6 approved syllabus → Phase 7 generators

This summary reflects the Phase 7 contract-focused deliverables: schema, prompt contracts, generator contracts, and test harnesses. Implementation of persistent storage and publishing is intentionally deferred until approval workflow and auditability are finalized.

🔷 Where You Are Now (State Check)

You currently have:

✅ Approved syllabus (Phase 6)
✅ Lesson / Quiz / Project generators with strict schemas (7.1–7.4)
✅ Approval workflow with immutability + audit (7.5)

What you do NOT have yet (by design):

- No packaging
- No publishing
- No learner-facing output
- No persistence coupling

This is correct.

🔶 What Comes Next (High-Level Roadmap)
Phase Purpose
7.6 Course Packaging (assemble approved content)
8.0 Persistence + Versioning
8.1 Publish API (read-only, immutable)
8.2 Regeneration + diffing
9.0 Delivery (UI, LMS, exports)

We now proceed one irreversible phase at a time.

🟣 Phase 7.6 — Course Packaging (NEXT)
🎯 Objective

Create a publishable course package that:

- Pulls only APPROVED content

- Freezes versions

- Is deterministic

- Is schema-validated

- Is immutable once built

No AI here. No generation. Only assembly.

🧱 Conceptual Model
Approved Syllabus

- Approved Lessons
- Approved Quizzes
- Approved Projects

---

→ CoursePackage (versioned, frozen)

🟦 PHASE 8 — Persistence, Publishing & Versioning

Phase theme:
“Once approved, content becomes immutable, versioned, and safely consumable.”

🔑 Why Phase 8 Exists

Until now:

1. Everything was generated, validated, approved
2. Nothing was persisted as a publishable artifact
3. Nothing was publicly readable

Phase 8 introduces:

1. Permanent storage
2. Versioned publishing
3. Read-only APIs
4. Admin UI for visibility
5. Zero mutation guarantees

🎯 Phase 8 Goals (Outcomes)

By the end of Phase 8, you will have:

✅ Immutable, versioned Course Packages stored in DB
✅ Read-only Publish APIs
✅ Admin UI to browse published courses & versions
✅ Strong guarantees:

1. Approved-only
2. No overwrites
3. No drift
4. No accidental edits

❌ Still no learner UX (that’s Phase 9)

🧱 Phase 8 Architecture Overview
Approved Syllabus + Content
↓
CoursePackage (built in Phase 7.6)
↓
Persisted (Phase 8.1)
↓
Published (Phase 8.2)
↓
Read-only APIs + Admin UI

🟦 Phase 8.1 — Persistence Layer
🎯 Objective

Persist CoursePackage safely and immutably.

🧬 Prisma Schema (REQUIRED)
📄 schema.prisma
enum CoursePackageStatus {
PUBLISHED
ARCHIVED
}

model CoursePackage {
id String @id @default(cuid())
syllabusId String
version Int

status CoursePackageStatus @default(PUBLISHED)

/// Frozen JSON blob (validated before insert)
json Json

createdAt DateTime @default(now())

@@unique([syllabusId, version])
@@index([syllabusId])
}

🔒 Rules

1. json is immutable
2. No UPDATEs allowed (only INSERT)
3. New version = new row

🧠 Persistence Helper
📁 lib/course/package/store.ts
export async function saveCoursePackage(
prisma,
pkg: CoursePackage
) {
return prisma.coursePackage.create({
data: {
syllabusId: pkg.syllabusId,
version: pkg.version,
json: pkg,
}
})
}

export async function getCoursePackagesBySyllabus(
prisma,
syllabusId: string
) {
return prisma.coursePackage.findMany({
where: { syllabusId },
orderBy: { version: 'desc' }
})
}

🧪 Tests (Required)

1. cannot insert duplicate version
2. json matches schema
3. version increments correctly

🟦 Phase 8.2 — Publish APIs (Read-only)
🎯 Objective

Expose published courses safely.

🌐 API Routes
📄 /api/courses/route.ts
GET /api/courses

Returns:

[
{
"syllabusId": "abc",
"latestVersion": 3,
"title": "Intro to AI"
}
]

📄 /api/courses/[syllabusId]/route.ts
GET /api/courses/:syllabusId

Returns:

{
"syllabusId": "abc",
"versions": [3,2,1]
}

📄 /api/courses/[syllabusId]/[version]/route.ts

🟦 Phase 8.3 — Admin UI (Read-only)
🎯 Objective

Allow admins to see what’s published.

🖥️ UI Pages

- /admin/courses
  - List syllabi
  - Show latest version
  - Status badge

- /admin/courses/[syllabusId]
  - Versions list
  - CreatedAt timestamps (if available)
  - View JSON button

- /admin/courses/[syllabusId]/[version]
  - Pretty JSON viewer
  - Download JSON

🟦 Phase 8.4 — Safety & Guarantees
🔒 Hard Rules to Enforce

Rule Where
Approved-only content Builder (7.6)
Insert-only persistence Store
Immutable JSON DB + code
Versioned publishing DB constraint
No mutation APIs Routes
Audit preserved Phase 7

🧪 Final Validation Checklist

Before moving to Phase 9:

- CoursePackage schema validated
- Multiple versions stored safely
- APIs return correct data
- No write routes exposed
- Admin UI reflects DB truth
- Tests pass
- CI green

🚀 What Comes After Phase 8
Phase 9 — Delivery

- Learner UI
- LMS export
- PDF / Markdown
- Personalization
- Monetization

````markdown
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
Sub-Phase Purpose
9.1 Learner content delivery APIs
9.2 Course Player UI
9.3 Progress tracking
9.4 PDF / LMS Exporters
9.5 Multi-tenant monetization
9.6 Access control & safety
```
````

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
id String @id @default(cuid())
userId String
courseId String
createdAt DateTime @default(now())
}

model LessonProgress {
id String @id @default(cuid())
userId String
courseId String
lessonIdx Int
completed Boolean
updatedAt DateTime @updatedAt

@@unique([userId, courseId, lessonIdx])
}

🧠 Prompt - Phase 9.3
Implement learner progress tracking.

Tasks:

- Add Enrollment and LessonProgress Prisma models
- Create APIs:
  POST /api/learn/enroll
  POST /api/learn/progress
  GET /api/learn/progress/[courseId]

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
Export Format
PDF Printable course
LMS SCORM-like ZIP (JSON + HTML)

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
  - lessons/\*.html
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
id String @id @default(cuid())
name String
}

model Product {
id String @id @default(cuid())
tenantId String
courseId String
priceCents Int
currency String
active Boolean
}

model Purchase {
id String @id @default(cuid())
userId String
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

🧠 Prompt — Phase 9.6
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
Phase Focus
10 Analytics & insights
11 Personalization
12 Marketplace
13 AI tutoring layer

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
Central session helper getServerSessionForHandlers() in session.ts (tests can inject global.**TEST_SESSION**).
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
Implement the small test helper to centralize global.**TEST_SESSION** setup/teardown and refactor tests to use it.
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
Area Why it matters
Audit Logs Regulatory, debugging, abuse detection
Tenant Scoping Prevent cross-tenant data leaks
Export Rate Limits Prevent DoS & cost abuse
Payload Size Guards Prevent memory / ZIP bomb attacks
✅ STEP 1 — Add Audit Logging (Highest Priority)
Objective

Ensure every sensitive write or export is auditable.

Events to log
Action Entity Actor
Product create/update Product admin
Purchase creation Purchase learner
Enrollment creation Enrollment learner
PDF export CoursePackage learner
LMS ZIP export CoursePackage learner
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

# 🧱 PART A — HELM / K8s PLAN FOR LEARNER SERVICES

## 🎯 Objective

Deploy learner-facing services in Kubernetes for:

- Read-only content delivery
- Scalable progress tracking (write-only progress APIs)
- Monetization safety
- Observability readiness for Phase 10

## 🧩 Services to Deploy

| Service     | Responsibility                                                         |
| ----------- | ---------------------------------------------------------------------- |
| learner-api | Phase 9 APIs (learn, progress, store) — stateless, horizontally scaled |
| admin-api   | Existing admin APIs (deployed separately)                              |
| evaluator   | Alerting/worker (Phase 5)                                              |
| postgres    | External (Neon / RDS)                                                  |
| redis       | External (Upstash / ElastiCache)                                       |
| pushgateway | Metrics bridge (Phase 10)                                              |

## 📦 Helm Chart Structure

```
helm/
└── ai-platform/
  ├── Chart.yaml
  ├── values.yaml
  ├── values-staging.yaml
  ├── values-prod.yaml
  ├── templates/
  │   ├── learner-api.deployment.yaml
  │   ├── learner-api.service.yaml
  │   ├── learner-api.hpa.yaml
  │   ├── evaluator.deployment.yaml
  │   ├── secrets.yaml
  │   ├── configmap.yaml
  │   └── serviceaccount.yaml
```

## 🔐 Secrets Strategy (Critical)

- NO secrets in values files.
- Create secrets from an env file and reference by name in values.

Create secret:

```bash
kubectl create secret generic ai-platform-secrets \
  --from-env-file=.env.production
```

Helm values reference:

```yaml
secrets:
  secretName: ai-platform-secrets
```

## 🚀 learner-api Deployment (Key Design)

- Stateless, horizontally scalable
- Read-only content APIs; write-only progress APIs
- Default replicas: 2 (HPA min 2 / max 10)
- Env from secrets: DATABASE_URL, REDIS_URL, NODE_ENV, TENANT_MODE=enabled

Resource defaults (values.yaml):

```yaml
replicaCount: 2
resources:
  requests:
  cpu: 100m
  memory: 256Mi
  limits:
  cpu: 500m
  memory: 512Mi
env:
  - DATABASE_URL
  - REDIS_URL
  - NODE_ENV
  - TENANT_MODE=enabled
```

## 📈 Autoscaling (HPA)

```yaml
hpa:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## 🔍 Observability Hooks (Phase 10 Ready)

- Expose `/metrics` endpoint (Prometheus)
- Push to Pushgateway when scraping is not feasible
  Suggested metrics:
- lesson_views_total
- lesson_completed_total
- course_enrollments_total
- purchase_completed_total

## 🧠 Deployment Flow (Recommended)

1. Build image (GitHub Actions)
2. Push to GHCR
3. Helm upgrade/install:

```bash
helm upgrade --install ai-platform ./helm/ai-platform \
  -f values-staging.yaml \
  --set image.tag=$GIT_SHA
```

## ✅ Quick validation

- `helm lint ./helm/ai-platform`
- `helm template ./helm/ai-platform -f values-staging.yaml`

## ⚠️ Risks & Recommendations

- Ensure managed Postgres & Redis provisioned before install
- NO secrets committed; secure .env.production
- Prefer Prometheus pull (scrape) where possible; use Pushgateway only when necessary
- Add readiness/liveness probes to learner-api
- Include RBAC / NetworkPolicy templates for production
- Tune resource requests/limits to real load
- CI: run helm lint/template on PRs touching helm/\*\*

---

## — SUMMARY OF CHANGES (Phase 10A)

- Objective: Deploy learner-facing services in K8s for safe, observable delivery
- Services: learner-api (stateless), admin-api (separate), evaluator, external postgres/redis, pushgateway
- Helm: created `ai-platform` chart with values and templates (deployment, service, HPA, evaluator, serviceaccount, configmap, secrets)
- Secrets: use k8s secret from env file; chart reads by secret name
- Autoscaling: CPU-based HPA (70% target), min 2 / max 10
- Observability: `/metrics` + Pushgateway metrics list
- CI: added helm lint/template validation on PRs

# PHASE 10 — Analytics, Insights & Intelligence

## 🎯 Goal

Turn learner activity into:

- Actionable insights
- Funnel metrics
- Course quality signals
- Monetization intelligence  
  Do this WITHOUT touching content or generation logic.

## 🔒 Core Rule

Phase 10 observes only. It must never modify:

- CoursePackage
- Lessons
- Quizzes
- Projects

## 🧩 Architecture

Learner Events → Event Collector → Analytics Store → Dashboards / Reports

## 📊 What We Measure

### Learner Engagement

- lesson_viewed
- lesson_completed
- quiz_attempted
- quiz_passed

### Funnel Metrics

- course_view → enroll → complete
- purchase → enroll → completion

### Quality Signals

- drop-off per lesson
- quiz failure rate
- time spent per lesson

## 🧱 Data Model (NEW)

```prisma
model AnalyticsEvent {
    id         String   @id @default(cuid())
    eventType  String
    userId     String?
    courseId   String?
    lessonIdx  Int?
    metadata   Json
    createdAt  DateTime @default(now())

    @@index([eventType, createdAt])
    @@index([courseId])
}
```

(Consider converting `eventType` to an enum in a controlled migration.)

---

## Phase 10.1 — Event Ingestion

Create a write-only, batched ingestion endpoint.

- Add AnalyticsEvent Prisma model
- POST /api/analytics/event
  - Accept batched events
  - Validate eventType against enum
  - Fire-and-forget design (write-only)
- Rules: No reads, no business logic
- Add unit tests

## Phase 10.2 — Client Event Emitters

Client-side emitters for:

- lesson_viewed
- lesson_completed
- quiz_attempted
- quiz_passed

Requirements:

- Debounced
- Non-blocking
- POST → /api/analytics/event
- No UI changes

## Phase 10.3 — Aggregation Jobs

Nightly aggregation jobs to compute:

- lesson completion rate
- average time per lesson
- course completion %

Store results in an `AnalyticsDailyAggregate` model. Implement as idempotent, testable job (no UI).

## Phase 10.4 — Admin Analytics APIs

Read-only admin endpoints (aggregated data only):

- GET /api/admin/analytics/course/[courseId]
- GET /api/admin/analytics/funnel/[courseId]

Rules:

- Return only aggregated data (no raw events)
- Admin-only access
- Add tests

## Phase 10.5 — Analytics Dashboard UI

Admin dashboard pages (read-only):

- Course analytics overview
- Lesson drop-off chart
- Funnel visualization

Requirements:

- Use Phase 10.4 APIs
- Simple chart library
- No write actions or exports yet

## Phase 10.6 — Intelligence Signals (Non-AI)

Rule-based signals saved to `AnalyticsSignal`:

- High drop-off lesson
- Low quiz pass rate
- High refund rate (approximate until explicit refunds available)

No AI suggestions yet. Add unit tests.

---

## ✅ Outcomes (Phase 10 Completed)

- Full analytics pipeline (ingest → aggregate → surface)
- Monetization insights decoupled from content
- Course quality signals persisted
- Enterprise observability in place
- AI-ready intelligence layer (non-generative signals)

## 🚧 Pending / Recommended

- Schedule nightly aggregator and signals worker (cron/orchestrator)
- Add admin read API for AnalyticsSignal and surface alerts in dashboard
- Replace purchase→enrollment refund heuristic with explicit refunds
- Convert eventType → enum via controlled migration
- Add retention/pruning for raw AnalyticsEvent
- Add job observability, retries, and audit logs
- Extend per-lesson aggregates for accurate drop-off metrics
- Improve admin UX (time-range, course picker, pagination, drilldowns)

## Suggestions / Next Steps (prioritized)

1. Add admin read API for AnalyticsSignal (high impact).
2. Schedule nightly aggregator + signals worker + monitoring (operational critical).
3. Implement retention policy and DB indexes for scaling.
4. Replace refund heuristic and convert eventType to enum safely.
5. Iterate dashboard to use per-lesson aggregates.

---

## 🚦 What Comes After Phase 10 (Preview)

| Phase | Focus                            |
| ----- | -------------------------------- |
| 11    | Personalization (non-generative) |
| 12    | AI Tutor (safe, scoped)          |
| 13    | Marketplace & creators           |
| 14    | Adaptive learning                |

## 🔥 Final Advice

- Content is immutable. Analytics is observational. Monetization is decoupled. AI is boxed and audited.
- Do not let shortcuts compromise the architecture.

---

## SUMMARY OF IMPLEMENTATION

**Intention:** Build a read-only, observational analytics pipeline to collect learner events, aggregate metrics for admins, and produce rule-based intelligence signals — without modifying content or generation logic.

**Achieved:**

- Event ingestion endpoint (batched, validated, write-only) with tests.
- Debounced, non-blocking client emitters.
- Nightly-style aggregator that upserts into `AnalyticsDailyAggregate` with tests.
- Admin read-only aggregated APIs with admin guard and tests.
- Server-rendered admin dashboard with overview, drop-off approximation, funnel visualization, and simple chart components.
- `AnalyticsSignal` model and rule-based signal generation (low completion, low quiz pass, high refund approximation) with tests.
- Tests updated to use test DB/session injection pattern for reliability.

**Next operational tasks:**

- Wire aggregator and signals into scheduler/cron.
- Expose admin APIs for signals.
- Implement retention, improve refund metric fidelity, and convert eventType to enum in a migration.

# PHASE 10 — Analytics, Insights & Intelligence

## 🎯 Goal

Turn learner activity into:

- Actionable insights
- Funnel metrics
- Course quality signals
- Monetization intelligence  
  Do this WITHOUT touching content or generation logic.

## 🔒 Core Rule

Phase 10 observes only. It must never modify:

- CoursePackage
- Lessons
- Quizzes
- Projects

## 🧩 Architecture

Learner Events → Event Collector → Analytics Store → Dashboards / Reports

## 📊 What We Measure

### Learner Engagement

- lesson_viewed
- lesson_completed
- quiz_attempted
- quiz_passed

### Funnel Metrics

- course_view → enroll → complete
- purchase → enroll → completion

### Quality Signals

- drop-off per lesson
- quiz failure rate
- time spent per lesson

## 🧱 Data Model (NEW)

```prisma
model AnalyticsEvent {
    id         String   @id @default(cuid())
    eventType  String
    userId     String?
    courseId   String?
    lessonIdx  Int?
    metadata   Json
    createdAt  DateTime @default(now())

    @@index([eventType, createdAt])
    @@index([courseId])
}
```

(Consider converting `eventType` to an enum in a controlled migration.)

---

## Phase 10.1 — Event Ingestion

Create a write-only, batched ingestion endpoint.

- Add AnalyticsEvent Prisma model
- POST /api/analytics/event
  - Accept batched events
  - Validate eventType against enum
  - Fire-and-forget design (write-only)
- Rules: No reads, no business logic
- Add unit tests

## Phase 10.2 — Client Event Emitters

Client-side emitters for:

- lesson_viewed
- lesson_completed
- quiz_attempted
- quiz_passed

Requirements:

- Debounced
- Non-blocking
- POST → /api/analytics/event
- No UI changes

## Phase 10.3 — Aggregation Jobs

Nightly aggregation jobs to compute:

- lesson completion rate
- average time per lesson
- course completion %

Store results in an `AnalyticsDailyAggregate` model. Implement as idempotent, testable job (no UI).

## Phase 10.4 — Admin Analytics APIs

Read-only admin endpoints (aggregated data only):

- GET /api/admin/analytics/course/[courseId]
- GET /api/admin/analytics/funnel/[courseId]

Rules:

- Return only aggregated data (no raw events)
- Admin-only access
- Add tests

## Phase 10.5 — Analytics Dashboard UI

Admin dashboard pages (read-only):

- Course analytics overview
- Lesson drop-off chart
- Funnel visualization

Requirements:

- Use Phase 10.4 APIs
- Simple chart library
- No write actions or exports yet

## Phase 10.6 — Intelligence Signals (Non-AI)

Rule-based signals saved to `AnalyticsSignal`:

- High drop-off lesson
- Low quiz pass rate
- High refund rate (approximate until explicit refunds available)

No AI suggestions yet. Add unit tests.

---

## ✅ Outcomes (Phase 10 Completed)

- Full analytics pipeline (ingest → aggregate → surface)
- Monetization insights decoupled from content
- Course quality signals persisted
- Enterprise observability in place
- AI-ready intelligence layer (non-generative signals)

## 🚧 Pending / Recommended

- Schedule nightly aggregator and signals worker (cron/orchestrator)
- Add admin read API for AnalyticsSignal and surface alerts in dashboard
- Replace purchase→enrollment refund heuristic with explicit refunds
- Convert eventType → enum via controlled migration
- Add retention/pruning for raw AnalyticsEvent
- Add job observability, retries, and audit logs
- Extend per-lesson aggregates for accurate drop-off metrics
- Improve admin UX (time-range, course picker, pagination, drilldowns)

## Suggestions / Next Steps (prioritized)

1. Add admin read API for AnalyticsSignal (high impact).
2. Schedule nightly aggregator + signals worker + monitoring (operational critical).
3. Implement retention policy and DB indexes for scaling.
4. Replace refund heuristic and convert eventType to enum safely.
5. Iterate dashboard to use per-lesson aggregates.

---

## 🚦 What Comes After Phase 10 (Preview)

| Phase | Focus                            |
| ----- | -------------------------------- |
| 11    | Personalization (non-generative) |
| 12    | AI Tutor (safe, scoped)          |
| 13    | Marketplace & creators           |
| 14    | Adaptive learning                |

## 🔥 Final Advice

- Content is immutable. Analytics is observational. Monetization is decoupled. AI is boxed and audited.
- Do not let shortcuts compromise the architecture.

---

## SUMMARY OF IMPLEMENTATION

**Intention:** Build a read-only, observational analytics pipeline to collect learner events, aggregate metrics for admins, and produce rule-based intelligence signals — without modifying content or generation logic.

**Achieved:**

- Event ingestion endpoint (batched, validated, write-only) with tests.
- Debounced, non-blocking client emitters.
- Nightly-style aggregator that upserts into `AnalyticsDailyAggregate` with tests.
- Admin read-only aggregated APIs with admin guard and tests.
- Server-rendered admin dashboard with overview, drop-off approximation, funnel visualization, and simple chart components.
- `AnalyticsSignal` model and rule-based signal generation (low completion, low quiz pass, high refund approximation) with tests.
- Tests updated to use test DB/session injection pattern for reliability.

**Next operational tasks:**

- Wire aggregator and signals into scheduler/cron.
- Expose admin APIs for signals.
- Implement retention, improve refund metric fidelity, and convert eventType to enum in a migration.

✅ Phase 10 Status — FINAL VERDICT
✔ What Phase 10 already achieved (this is important)

You now have:

✅ Write-only analytics ingestion (safe, batched, validated)

✅ Immutable aggregation layer (daily aggregates, tested)

✅ Admin read-only analytics APIs

✅ Dashboard UI (overview, funnel, drop-off approximation)

✅ Rule-based intelligence signals

✅ Testable, deterministic analytics pipeline

✅ No content mutation, no feedback loops yet (by design)

This satisfies the entire intent of Phase 10.

⚠️ What’s still pending — and what it means

Let’s classify the pending items properly:

🔴 Operational blockers (must do before “real usage”)

These are not conceptual, but runtime:

Schedule aggregator + signal jobs

Basic monitoring for job success/failure

Without these:

Analytics exist only when manually triggered

Signals never update automatically

👉 These are activation steps, not new features.

🟡 Quality / accuracy improvements (safe to defer)

These are refinements, not blockers:

Refund accuracy

EventType enum

Retention/pruning

Per-lesson drop-off accuracy

Dashboard UX polish

👉 These belong to Phase 10.x hardening or later.

🎯 Strong Recommendation (Clear Answer)
✅ Do ONE small thing, then move to Phase 11

Wire the nightly jobs + minimal monitoring, then proceed to Phase 11.

Why?

Phase 10 without scheduled jobs is dormant

Phase 11 depends on analytics being alive

Doing admin UX or retention now would be premature optimization

🛠 What I Recommend You Do Now (Concrete)
Step 1 — Activate Phase 10 (Required)

Ask Copilot to do only this:

“Wire analyticsAggregator and generateSignalsForAllCourses into the existing orchestrator/cron runner, add basic success/failure logging and an audit entry per run.”

This should include:

Nightly (or hourly) execution

Non-overlapping run guard

AuditLog entries

One metric/log per run (success / failure / duration)

⏱ This is usually <1 day of work.

PART 1 — Copilot-ready instructions
🔌 Phase 10 Job Wiring (Activation, Not New Features)
Objective

Activate analytics by scheduling aggregation + signal jobs with:

deterministic execution

auditability

safety (no overlap)

minimal operational visibility

No schema redesign. No feature creep.

10.J1 — Job Runner Entry Point
Prompt to Copilot
Create a new server-side job runner for analytics aggregation and signals.

File: src/jobs/analyticsJobs.ts

Responsibilities:

- Export a single async function runAnalyticsJobs()
- Inside it:
  1. Call analyticsAggregator.runForAllCourses()
  2. Call generateSignalsForAllCourses()
- Ensure execution order: aggregation first, then signals
- Wrap the full run in try/catch
- Measure execution time (Date.now)
- Do NOT throw on partial failure; log and continue
- Return a structured result:
  { success: boolean, durationMs: number, error?: string }

Constraints:

- No DB writes except those performed by the called functions
- No content mutation
- No direct Prisma import; use injected db or shared helper pattern

  10.J2 — Non-overlapping Execution Guard
  Prompt to Copilot
  Add a non-overlapping execution guard for analytics jobs.

Approach:

- Create src/jobs/jobLock.ts
- Implement acquireJobLock(jobName: string, ttlMs: number)
- Implement releaseJobLock(jobName: string)
- Use Prisma with a JobLock table OR reuse an existing lock mechanism if present

Rules:

- If a lock exists and is not expired, abort execution gracefully
- Do not throw; return { skipped: true, reason: "locked" }
- Ensure lock auto-expires if process crashes

(If no JobLock table exists, Copilot should add it via Prisma with minimal fields: jobName, lockedUntil.)

10.J3 — Audit Logging
Prompt to Copilot
Add audit logging for analytics job runs.

For each run of runAnalyticsJobs():

- Write a non-blocking audit entry with:
  action: "ANALYTICS_JOB_RUN"
  status: SUCCESS | FAILED | SKIPPED
  durationMs
  error (if any)
- Reuse existing audit log helper (do not invent new infra)
- Audit failure must NEVER block job completion

  10.J4 — Scheduler Hook
  Prompt to Copilot
  Wire analytics jobs into the existing scheduler / orchestrator.

Options (pick what exists):

- If cron-based: add a nightly cron entry
- If serverless scheduled job: add handler
- If GitHub Actions (temporary): nightly workflow calling the job

Rules:

- Frequency: once per day (UTC or system timezone)
- Ensure job lock is checked before execution
- Ensure logs are emitted for start/end
- No retries yet (fail fast, observable)

  10.J5 — Minimal Monitoring Signal
  Prompt to Copilot
  Add minimal observability for analytics jobs.

Requirements:

- Log structured JSON:
  { job: "analytics", status, durationMs }
- Increment a simple counter (if metrics infra exists)
- Add TODO comments for future alerting
- Do NOT add dashboards or alerts yet

✅ Completion Criteria (Phase 10 Activation)

Copilot should confirm:

Jobs run on schedule
Only one instance runs at a time
Audit logs show job outcomes
No tests broken
No new write paths to content tables

➡️ Once done: Phase 10 is officially “LIVE”

# Phase 10 — implementation Summary

Intended
Lock: Add non-overlapping job lock for analytics runs (DB-backed JobLock).
Implementation: Create jobLock.ts and use in analyticsJobs.ts.
Audit: Record an audit entry per run via log.ts.
Scheduling: Wire runAnalyticsJobs() into the orchestrator (orchestrator.ts) with env control.
Metrics: Add Prometheus counter and increment on run (metrics-server.ts).
Tests & Quality: Add unit tests and fix lint/type issues; validate via CI/test suite.
Completed
Prisma model: Added JobLock to schema.prisma.
Lock implementation: Added jobLock.ts (acquire/release semantics, test-friendly).
Job runner: Updated analyticsJobs.ts to use the lock, write non-blocking audit entries, increment metrics, and release lock.
Orchestrator: Scheduling hook added in orchestrator.ts (env-controlled).
Metrics: Added analytics_job_runs_total counter and incAnalyticsJobRun() in metrics-server.ts.
Tests: Added analyticsJobs.test.ts and fixed related tests; full test suite passed (32 suites, 82 tests).
Lint/TS: Replaced problematic console.\* usages with project logger and fixed TS typing issues.
Pending
DB migration: Apply Prisma migration so JobLock exists in the running DB.
Integration tests (optional): Run job runner end-to-end against a migrated test/staging DB.
Enable scheduler: Turn on scheduling with ORCHESTRATOR_ENABLE_ANALYTICS=1 (only after migration).
Alerting & dashboards: Add Prometheus alert rules and an admin dashboard for analytics_job_runs_total (e.g., alert on consecutive failures / high duration).
Monitor: Observe audit logs and metrics for first runs in staging before production enablement.
Suggestions / Next Steps
Run the Prisma migration in a dev/staging environment.

Enable orchestrator scheduling in staging and verify one manual run first.

Add a Prometheus alert rule (example concept): alert when failed runs > 0 over 15m or failure rate spikes; and create an on-call escalation to inspect AuditLog entries.

Run an integration smoke test after migration.

If you want, I can:

Create and run the Prisma migration now (needs DATABASE_URL), or
Draft a sample Prometheus alert rule and a short monitoring playbook, or
Enable the orchestrator in staging and run a manual job run.

# Phase 11

📘 PHASE 11 — Adaptive Intelligence (Human-in-the-Loop)
1️⃣ Phase 11 — Why This Phase Exists

Up to Phase 10, the system can:

Generate content safely
Publish immutable packages
Observe learner behavior
Produce analytics signals

What it cannot yet do:
Turn insight into actionable intelligence without breaking trust.

Phase 11 introduces interpretation + recommendation, not mutation.

2️⃣ Phase 11 — Core Principle (Non-Negotiable)
The system may observe and suggest — but never change content automatically.
This ensures:
No silent regressions
No hallucinated rewrites
No circular self-training
Full human accountability

3️⃣ Phase 11 — Conceptual Architecture
AnalyticsEvent (raw)
↓
AnalyticsDailyAggregate
↓
AnalyticsSignal (rule-based)
↓
Insight Engine (Phase 11)
↓
ContentSuggestion (immutable)
↓
Admin Review UI

🚫 No path back into generators
🚫 No auto-approval
🚫 No model retraining

4️⃣ Phase 11 — Data Models
11.1 ContentSuggestion (Core Model)

This is the single output of Phase 11.

Prisma Schema
enum SuggestionScope {
COURSE
MODULE
LESSON
QUIZ
}

enum SuggestionType {
LOW_COMPLETION
HIGH_RETRY
DROP_OFF
LOW_ENGAGEMENT
CONTENT_CLARITY
}

enum SuggestionSeverity {
LOW
MEDIUM
HIGH
}

enum SuggestionStatus {
OPEN
ACCEPTED
DISMISSED
}

model ContentSuggestion {
id String @id @default(cuid())
courseId String
scope SuggestionScope
targetId String
type SuggestionType
severity SuggestionSeverity
message String
evidenceJson Json
status SuggestionStatus @default(OPEN)
createdAt DateTime @default(now())
}

Rules
Insert-only
Status is the only mutable field
Evidence must be reproducible

5️⃣ Phase 11 Activities (With Copilot Instructions)
🧠 11.2 Insight Engine (Rule Interpreter)
Goal

Convert AnalyticsSignal → ContentSuggestion

Copilot Instruction — Insight Engine
Create the Insight Engine that converts AnalyticsSignal records
into ContentSuggestion records.

File: src/insights/engine.ts

Requirements:

- Export generateSuggestionsForSignal(signal)
- Use pure deterministic rule mapping
- Each signal maps to 1+ suggestions
- Populate:
  - message (human-readable)
  - severity (rule-based)
  - evidenceJson (metrics snapshot)

Rules:

- No DB reads except the signal itself
- No deduplication
- No content mutation
- Suggestions must be reproducible from inputs

Do NOT:

- Call any generator
- Modify syllabus/lesson/package tables

Example Mapping (Implicit)
Signal Suggestion
LOW_COMPLETION Lesson too long / unclear
HIGH_RETRY Quiz ambiguity
DROP_OFF Module difficulty spike

🧾 11.3 Suggestion Persistence
Goal

Persist suggestions immutably.

Copilot Instruction — Store Layer
Create a persistence helper for ContentSuggestion.

File: src/insights/store.ts

Functions:

- saveSuggestions(suggestions[])
- listSuggestions(filters)
- updateSuggestionStatus(id, status)

Rules:

- Only status can be updated
- All writes must be audited
- No deletes
- Use Prisma client injection pattern

🧪 11.4 Tests (Mandatory)
Goal
Guarantee determinism + safety.

Copilot Instruction — Tests
Add unit tests for Phase 11.

Paths:

- tests/phase11/engine.test.ts
- tests/phase11/store.test.ts

Test cases:

- Same AnalyticsSignal always produces same suggestions
- EvidenceJson matches expected metrics
- Status transitions work (OPEN → ACCEPTED / DISMISSED)
- No other fields can be mutated

Do NOT mock Prisma excessively; use test DB injection.

🔒 11.5 Admin APIs (Read / Review)

## APIs

Route Purpose
GET /api/admin/suggestions List
POST /api/admin/suggestions/:id/accept Approve
POST /api/admin/suggestions/:id/dismiss Reject

# Copilot Instruction — Admin APIs

Implement admin-only APIs for ContentSuggestion.

Files:

- src/app/api/admin/suggestions/route.ts
- src/app/api/admin/suggestions/[id]/accept/route.ts
- src/app/api/admin/suggestions/[id]/dismiss/route.ts

Rules:

- Admin auth required
- Accept/Dismiss updates status only
- Log audit event on every action
- No deletes
- No edits to message or evidence

# 🖥️ 11.6 Admin UI (Review Dashboard)

UI Capabilities

List suggestions

Filter by severity, course, scope

View evidence JSON

Accept / Dismiss

🚫 No edit
🚫 No regenerate
🚫 No approve chain

## Copilot Instruction — UI

Create an admin UI for reviewing content suggestions.

Path:

- app/admin/suggestions/page.tsx
- components/SuggestionCard.tsx

Features:

- Server-rendered list
- Severity badge
- Expandable evidence viewer
- Accept / Dismiss buttons

Rules:

- Read-only except status
- Optimistic UI allowed
- No client-side mutation of suggestion data

# 🧾 11.7 Audit Logging

## Copilot Instruction — Audit

Ensure every suggestion lifecycle action is audited.

Events:

- SUGGESTION_CREATED
- SUGGESTION_ACCEPTED
- SUGGESTION_DISMISSED

Rules:

- Non-blocking
- Never throw
- Include suggestionId, adminId (if applicable)

# ⏰ 11.8 Job Wiring (Optional but Recommended)

## Copilot Instruction — Job Hook

Wire Insight Engine into nightly analytics job.

When:

- After generateSignalsForAllCourses()

Steps:

- Fetch new AnalyticsSignal records
- Generate ContentSuggestions
- Persist them

Rules:

- Idempotent per signal
- Guard against duplicates if signal already processed
- Use job lock

6️⃣ Phase 11 Completion Checklist

✅ Suggestions generated automatically
✅ Zero content mutation
✅ Deterministic + reproducible
✅ Admin-controlled acceptance
✅ Fully auditable
✅ No generator coupling

7️⃣ What Phase 11 Enables (Strategically)

After Phase 11, your system gains:

Institutional memory

Quality evolution without risk

Explainable AI assistance

Human-aligned intelligence

Long-term trust

8️⃣ What Comes Next (Phase 12 Preview)

Phase 12: Guided Regeneration

Suggestions become inputs

Human explicitly triggers regeneration

Side-by-side diffing

Versioned upgrades

But only after Phase 11 is stable.

Great question. Phase 11 is almost complete prompt-wise, but a few critical Copilot prompts were implicit, not explicitly written. Below is a clean, exhaustive list of the missing prompts, written in Copilot-ready, copy-pasteable form, with no overlap with what you already have.

I’ll group them by what gap they close.

✅ What You Already Have (for clarity)

You already received prompts for:

Insight Engine logic

Store layer

Admin APIs

Admin UI

Audit logging

Job hook (optional)

Tests (engine + store)

So we will not repeat those.

🔴 MISSING PROMPTS — PHASE 11

These are required to complete Phase 11 cleanly, safely, and production-ready.

🧱 11.A Prisma Migration Prompt (Missing)

You defined the schema, but did not give Copilot the migration + safety rules prompt.

Copilot Prompt — Prisma Migration
Add Prisma schema and migration for Phase 11 ContentSuggestion.

Steps:

1. Update schema.prisma:
   - Add enums:
     SuggestionScope, SuggestionType, SuggestionSeverity, SuggestionStatus
   - Add ContentSuggestion model exactly as specified in PHASE_11.md

2. Generate migration:
   - Name: add_content_suggestions
   - Ensure JSON field uses Prisma Json
   - No foreign key cascades
   - No soft-delete field

3. Validate:
   - prisma generate
   - prisma migrate dev
   - Ensure no existing tables are modified

Rules:

- Insert-only semantics
- Status is the only mutable column
- No indexes yet unless explicitly requested

Why this matters:

Prevents accidental cascades

Prevents soft-delete creep

Locks immutability at DB level

🧩 11.B Signal → Suggestion Mapping Registry (Missing)

Right now, mapping logic is implicit. You need a single deterministic registry.

Copilot Prompt — Mapping Registry
Create a deterministic mapping registry for AnalyticsSignal → ContentSuggestion.

File: src/insights/mappings.ts

Requirements:

- Export mapSignalToSuggestions(signal)
- Pure function (no DB access)
- One signal can emit multiple suggestions
- Each mapping defines:
  - scope
  - type
  - severity
  - message template
  - evidence selector

Rules:

- No randomness
- No date/time logic
- Mapping must be exhaustively switch-based on signal.type
- Throw error on unknown signal types

Why this matters:

Prevents silent logic drift

Makes suggestions explainable

Enables future review/versioning

🧪 11.C Mapping Registry Tests (Missing)

You tested the engine, but not the mapping table itself.

Copilot Prompt — Mapping Tests
Add unit tests for AnalyticsSignal → ContentSuggestion mappings.

File: tests/phase11/mappings.test.ts

Test cases:

- Each signal type produces expected suggestion types
- Severity mapping is correct
- EvidenceJson contains expected metrics
- Unknown signal type throws error

Rules:

- Use snapshot-style expectations for evidenceJson
- No Prisma usage

Why this matters:

Protects logic from regression

Guarantees reproducibility

🔁 11.D Idempotency Guard Prompt (Missing)

Phase 11 must not re-emit suggestions repeatedly for the same signal.

Copilot Prompt — Idempotency Guard
Add idempotency protection for ContentSuggestion creation.

Approach:

- Extend ContentSuggestion with sourceSignalId (String)
- Enforce unique constraint on (sourceSignalId, type, targetId)

Update:

- Prisma schema
- Insight Engine persistence logic

Rules:

- Same signal must never create duplicate suggestions
- Engine must skip already-processed signals
- Do NOT delete or overwrite suggestions

Why this matters:

Prevents noise explosion

Makes nightly jobs safe

🔐 11.E Admin Authorization Guard Prompt (Missing)

You mentioned “admin-only”, but did not specify enforcement logic.

Copilot Prompt — Admin Guard
Add a reusable admin authorization guard.

File: src/auth/adminGuard.ts

Requirements:

- Export requireAdmin(session)
- Throw HTTP 403 if user is not admin
- Use role-based check (session.user.role === 'ADMIN')

Apply guard to:

- All /api/admin/suggestions routes
- Future Phase 11 admin APIs

Rules:

- No silent fallbacks
- No client-side checks

Why this matters:

Prevents accidental privilege escalation

Centralizes security logic

🧾 11.F Admin Audit Event Types (Missing)

You referenced audit logging but didn’t define event taxonomy.

Copilot Prompt — Audit Events
Extend audit logging with Phase 11 events.

Add constants:

- CONTENT_SUGGESTION_CREATED
- CONTENT_SUGGESTION_ACCEPTED
- CONTENT_SUGGESTION_DISMISSED

Ensure:

- All suggestion lifecycle events are logged
- Payload includes:
  - suggestionId
  - courseId
  - adminId (if applicable)
  - timestamp

Rules:

- Non-blocking
- Never throw

Why this matters:

Compliance

Forensic traceability

Enterprise readiness

📊 11.G Admin Dashboard Signal → Suggestion Linking (Missing)

Your dashboard shows analytics, but doesn’t connect signals to suggestions yet.

Copilot Prompt — Dashboard Linking
Enhance admin analytics dashboard to surface content suggestions.

Steps:

- For a given courseId:
  - Fetch AnalyticsSignals
  - Fetch ContentSuggestions
- Group suggestions by:
  - scope
  - severity
  - signal type

UI:

- Show “Suggested Actions” panel
- Clicking opens suggestion details
- Read-only evidence viewer

Rules:

- No inline edits
- No generator triggers

Why this matters:

Makes Phase 11 usable

Closes the insight → action loop

⏳ 11.H Retention Policy Prompt (Optional but Recommended)

Without this, suggestions grow unbounded.

Copilot Prompt — Retention
Add retention policy for Phase 11 data.

Policy:

- ContentSuggestion: retain forever
- AnalyticsSignal: retain 180 days
- Raw AnalyticsEvent: retain 90 days

Implementation:

- Scheduled job
- Soft-delete or archive (no hard deletes unless required)
- Audit every pruning action

Rules:

- Never delete suggestions
- Never delete aggregates

✅ FINAL STATUS — PHASE 11 PROMPT COMPLETENESS
Area Status
Insight Engine ✅
Store ✅
Admin APIs ✅
Admin UI ✅
Audit ✅
Jobs ✅
Prisma migration ❌ → now added
Signal mapping registry ❌ → now added
Idempotency guard ❌ → now added
Admin guard ❌ → now added
Audit taxonomy ❌ → now added
Dashboard linkage ❌ → now added
Retention policy ⚠ optional
🎯 Recommendation (Strong)

Execute missing prompts in this order:

1️⃣ Prisma migration
2️⃣ Mapping registry
3️⃣ Mapping tests
4️⃣ Idempotency guard
5️⃣ Admin guard
6️⃣ Audit events
7️⃣ Dashboard linking

Once done → Phase 11 is architecturally complete.

# Phase 11 implementation summary

Intended

Goal: Convert AnalyticsSignal → reproducible, insert-only ContentSuggestion records for admin review (no auto-mutation).
Core outputs: ContentSuggestion model with enums (scope/type/severity/status), evidenceJson, message, and status (only mutable field).
Components: deterministic mapping registry, Insight Engine (generateSuggestionsForSignal), persistence/store layer (saveSuggestions, listSuggestions, updateSuggestionStatus), admin APIs/UI, audit logging, idempotent job wiring, tests, and Prisma migration.
Rules/constraints: Insert-only, audited every lifecycle action, idempotency per-signal, no generator calls, admin-only approval, no streaming/progress, enums for statuses.
Completed

Engine & Mapping: Deterministic mapping + engine implemented (signal → suggestion) and unit-tested for reproducibility.
Store & Idempotency: Persistence helper added with idempotency guard (unique sourceSignalId pattern) and audited writes.
Prisma Schema: ContentSuggestion model added to schema with necessary fields and unique constraints (sourceSignalId usage implemented).
Admin APIs & UI: Admin routes and server page + client SuggestionCard created to list, view evidence, Accept/Dismiss (status-only).
Audit: Audit logging hardened and integrated for create/accept/dismiss events (non-blocking).
Job Wiring & Scripts: Insight Engine wired into analytics job with job-lock; local runner and lock-clear scripts added and exercised.
Tests: Phase 11 engine/store unit tests added and passing in the test suite.
Tooling fixes: Type-check / lint / unit tests made to pass after resolving next-auth typing/casting issues and small test/jest mappings.
Pending

Prisma migration run & DB verification: Migration must be generated/applied in each environment and verified (migration file present? run prisma migrate dev).
Centralized module augmentation: next-auth global augmentation could be finalized so fewer inline casts remain (optional refactor).
Dashboard linkage & grouping: Admin analytics dashboard linkage to surface signals → suggestions grouped by scope/severity (recommended in doc) not fully surfaced in dashboard.
Retention / archival job: Optional policy (signals retention 180d, raw 90d) and scheduling not implemented.
Integration tests: End-to-end test that runs job against test DB to assert suggestion creation + audit + idempotency still recommended.
Operational monitoring: Prometheus/alerts or retry instrumentation for job failures not yet added.
Suggestions

Run & commit Prisma migration (name: add_content_suggestions) and document migration steps in repo README; then run CI DB migration to validate schema in CI.
Add an integration test that runs the analytics job against test DB to assert (a) suggestions are created, (b) duplicates are not created on re-run, (c) audit rows recorded.
Add explicit audit event constants (CONTENT_SUGGESTION_CREATED/ACCEPTED/DISMISSED) in a shared module and use them in store + API handlers for consistent telemetry.
Optional: Add a small Retention scheduler job (configurable cron) that archives/prunes raw events while preserving ContentSuggestion forever.
Optional stricter typing: Create a single next-auth module augmentation file placed in types or next-auth.d.ts and ensure tsconfig typeRoots/includes pick it up, then remove remaining inline client casts for cleaner types.
If you want, I can:

Create and apply the Prisma migration and run it locally, or
Add the integration test for job → suggestion → audit idempotency, or
Implement the audit event constants and wire them through store/APIs.

# 📘 Phase 12 — Regeneration Jobs (Admin Control Plane)

Phase Goal

Provide a safe, admin-only, observable control plane for content regeneration jobs — without allowing:

- Direct content mutation
- Generator invocation from UI
- Editing or deleting jobs
- Re-running completed jobs

This phase establishes human-in-the-loop regeneration control, not automation.

## Why Phase 12 Exists

Earlier phases intentionally separated:

- Insight generation (Phase 11)
- Content generation (Phases 6–7)
- Analytics (Phase 10)
- Phase 12 bridges intent → execution without violating immutability or safety guarantees.

## Core Principles

Principle Rule

- Insert-only RegenerationJob rows are never deleted or edited
- Explicit action Only admins may trigger regeneration
- Generator isolation UI/API never call generators
- Read-only UI JSON is observable, never editable
- Auditability Every lifecycle event is logged
- Determinism Triggering creates state change only
- Scope (What This Phase Covers)

## ✅ Admin UI to:

- List regeneration jobs
- Inspect job details
- Trigger pending jobs

## ✅ APIs to:

- Read job metadata
- Transition job state from PENDING → RUNNING

## ❌ Explicitly out of scope:

- Editing jobs
- Deleting jobs
- Retrying completed/failed jobs
- Background execution
- Steaming output
- Scheduling logic

Data Model (Assumed)
RegenerationJob {
id
status // PENDING | RUNNING | COMPLETED | FAILED
targetType
targetId
instructionJson
outputRef
errorJson
createdAt
createdBy
}

## Only status may change.

### API Contract

Method Route Purpose
GET /api/admin/regeneration-jobs List jobs
GET /api/admin/regeneration-jobs/[id] Job detail
POST /api/admin/regeneration-jobs/[id]/trigger Transition to RUNNING

No other HTTP verbs permitted.

### UI Pages

Path Description
/admin/regeneration-jobs Job list
/admin/regeneration-jobs/[id] Job detail

### UI is server-rendered, admin-only.

Audit Events
Event
REGEN_JOB_CREATED
REGEN_JOB_TRIGGERED
REGEN_JOB_COMPLETED
REGEN_JOB_FAILED

Audit failures must never block state transitions.

Completion Criteria

### Phase 12 is complete when:

- Admins can observe all regeneration jobs
- Admins can trigger pending jobs
- No mutation beyond status change is possible
- All actions are audited
- Tests enforce invariants
- No generators are callable from UI or routes

### What Comes Next

Phase 13 will:

- Execute jobs asynchronously
- Produce outputs
- Attach outputs to immutable references
- Surface results for human approval

You should run these prompts sequentially, only moving to the next after:

Code compiles

Tests pass

You visually inspect the output

🔷 Phase 12 — Copilot Prompt Set (Sectioned & Safe)

## How to use

Copy one prompt at a time
Paste into Copilot Chat
Let it finish
Run lint / type-check / tests
Then proceed to the next prompt

## 🧱 Prompt 12.1 — Establish Invariants (Read First)

Purpose: Anchor Copilot’s behavior for the entire phase
Run this first, always

We are implementing Phase 12: Regeneration Jobs Admin Control Plane.

Global invariants (do not violate in this phase):

- RegenerationJob rows are INSERT-ONLY
- No job may be edited or deleted
- Only status transitions are allowed
- Allowed status transition: PENDING → RUNNING only
- No generators may be called
- No content mutation is allowed
- UI and APIs are ADMIN-ONLY
- All job actions must be audited
- No background execution or scheduling
- No streaming or progress updates
- No retries or re-triggers for completed/failed jobs

If a change would violate these invariants, do NOT implement it.

Acknowledge and wait for next instruction.

✅ Expected output: Copilot confirms understanding, no code changes.

## 🔌 Prompt 12.2 — Admin API: List Regeneration Jobs

Maps to: Phase 12 → API Contract → List
Goal: Read-only list endpoint

Create a new admin-only API route:

GET /api/admin/regeneration-jobs

Requirements:

- Read-only
- Admin-auth guarded
- No pagination yet
- Sorted by createdAt DESC
- Returns minimal metadata:
  id, status, targetType, targetId, createdAt, createdBy

Constraints:

- Do not allow POST/PUT/PATCH/DELETE
- Return 405 for unsupported methods
- Do not modify any database rows
- Do not include instructionJson or outputRef here

Add unit tests asserting:

- Non-admin access is rejected
- PUT/DELETE return 405
- Returned data is sorted correctly

## 🔍 Prompt 12.3 — Admin API: Regeneration Job Detail

Maps to: Phase 12 → API Contract → Detail
Goal: Read-only job inspection

Create a new admin-only API route:

GET /api/admin/regeneration-jobs/[jobId]

Requirements:

- Read-only
- Admin-auth guarded
- Returns full job record:
  id, status, targetType, targetId,
  instructionJson, outputRef, errorJson,
  createdAt, createdBy

Constraints:

- No mutation
- No status change
- Return 404 if job not found
- Return 405 for non-GET methods

Add unit tests asserting:

- Admin can fetch job
- Non-admin is rejected
- Unsupported methods return 405

## ▶️ Prompt 12.4 — Admin API: Trigger Regeneration Job

Maps to: Phase 12 → Trigger Contract
This is the most critical prompt

Create a new admin-only API route:

POST /api/admin/regeneration-jobs/[jobId]/trigger

Behavior:

- Validate job exists
- Validate status === PENDING
- Inside a DB transaction:
  - Update status to RUNNING
  - Write audit event: REGEN_JOB_TRIGGERED
- Return updated job metadata

Constraints:

- Do NOT execute any generator
- Do NOT enqueue background work
- Do NOT modify any other fields
- If status !== PENDING → return 409 Conflict
- Unsupported methods return 405

Add unit tests asserting:

- Trigger works only for PENDING jobs
- Trigger is idempotent-safe
- Trigger does not call generators
- Audit log is written

## 🖥️ Prompt 12.5 — Admin UI: Job List Page (Server-rendered)

Maps to: Phase 12 → UI → Job List

Create a server-rendered admin page at:

/admin/regeneration-jobs

UI requirements:

- Server component
- Admin-only guard
- Fetch from GET /api/admin/regeneration-jobs
- Display table columns:
  id, status badge, targetType, targetId, createdAt
- Each row links to detail page

Constraints:

- No client-side fetching
- No mutations
- No buttons
- No inline JSON editing

## 📄 Prompt 12.6 — Admin UI: Job Detail Page

Maps to: Phase 12 → UI → Job Detail

Create a server-rendered admin page at:

/admin/regeneration-jobs/[jobId]

Render:

- Job metadata
- instructionJson (read-only)
- outputRef (read-only, if exists)
- errorJson (read-only, if exists)
- Audit events (if available)

Trigger Button:

- Visible only when status === PENDING
- POSTs to trigger endpoint
- Disabled while submitting
- Redirects back to same page

Constraints:

- No editing
- No retry button
- No delete button

## 🧩 Prompt 12.7 — ReadOnlyJsonViewer Component

Maps to: Phase 12 → UI Utilities

Create a reusable ReadOnlyJsonViewer component.

Features:

- Pretty-printed JSON
- Collapsible nodes
- Copy-to-clipboard button
- Download JSON button

Constraints:

- Absolutely read-only
- No textarea or input
- No mutation handlers
- Used for instructionJson, outputRef, errorJson

## 📋 Prompt 12.8 — Audit Logging Hardening

Maps to: Phase 12 → Audit

Ensure audit logging exists for:

- REGEN_JOB_TRIGGERED

Requirements:

- Non-blocking
- Failures must not stop the request
- Include admin user id and job id
- Centralized helper preferred

Add a unit test asserting audit is called on trigger.

## 🧪 Prompt 12.9 — Final Safety & Regression Tests

Maps to: Phase 12 → Completion Criteria

Add regression tests to enforce Phase 12 invariants:

- ❌ Job cannot be triggered twice
- ❌ Completed/Failed jobs cannot be triggered
- ❌ PUT/PATCH/DELETE not allowed anywhere
- ❌ No generator functions are imported or called
- ✅ Status transition only affects status column

Run:

- npm run lint
- npm run type-check
- npm test

Fix any violations before stopping.

🛑 STOP POINT

After Prompt 12.9, Phase 12 is complete.

Do not proceed to execution, scheduling, retries, or Phase 13 unless explicitly instructed.

✅ Why This Will Work

- Each prompt has one responsibility
- Constraints are locally restated
- Copilot can reason within context limits
- No hallucination space
- Easy to debug if something goes wrong

# Summary of Phase 12 implemetation

## What Was Intended?

- Goal: Build a safe, admin-only control plane for RegenerationJobs: list, inspect, and trigger jobs without allowing edits or generator runs.
- Deliverables: Read-only APIs (GET list/detail, POST trigger), server-rendered admin UI pages, a reusable read-only JSON viewer, non-blocking audit for REGEN_JOB_TRIGGERED, and tests enforcing Phase‑12 invariants.

## What Did We Complete?

- APIs: route.ts (list), route.ts (trigger — now calls centralized non-blocking audit).
- UI: Server pages page.tsx (list) and page.tsx (detail); client trigger button TriggerJobButton.tsx.
- UI Utility: Added ReadOnlyJsonViewer.tsx (client component with collapsible view, copy, download).
- Audit: Central helper log.ts used; trigger path switched to fire‑and‑forget logAuditEvent to satisfy “non‑blocking” requirement.
- Tests: Updated regenerationJobs.trigger.test.ts; added regression tests regenerationJobs.regressions.test.ts enforcing invariants (double-trigger, completed/failed blocking, method 405s, no generators imported, status-only update).
  Verification: Ran lint, type-check, and full test suite — all green (full test run after changes: 42 suites, 104 tests passed).

## What Is Pending?

- Integration: Replace raw <pre/> JSON rendering in page.tsx with the new ReadOnlyJsonViewer.tsx.
- UI Tests: End-to-end or integration tests for admin detail page + trigger flow (client behavior, redirect, error handling).
  Audit resilience: Consider stronger handling/monitoring for audit failures (alerts, metrics, or a durable fallback) beyond current fire‑and‑forget logging.
  UX / Scale: Pagination/filtering for the list endpoint and richer audit browsing in the admin UI (optional, future phases).

## Suggestions

- Integrate viewer now: I can wire ReadOnlyJsonViewer into page.tsx and re-run checks (recommended next step).
- Add an E2E test: Add one Cypress/Playwright test to exercise admin trigger end‑to‑end (auth, POST trigger, page reload, audit presence).
  Monitor audit writes: Add a lightweight metric/alert when logAuditEvent emits warnings so audit failures become observable.
- Future improvement: Add server-side pagination and filtering to the list API if the job set grows.

## 📘 Phase 13 — Regeneration Execution Worker (Isolated, Deterministic, Audited)

13.0 Phase Intent (Read This First)
Goal

Introduce a strictly isolated execution layer that can materialize RegenerationJobs into outputs (documents, regenerated assets, exports) without giving the admin UI, APIs, or analytics any execution powers.

Phase 13 turns:

“A triggerable intent” → “A completed artifact”

Core Principle

Control Plane ≠ Execution Plane

Phase 12 created the control plane.
Phase 13 introduces the execution plane — headless, locked down, non-interactive.

## 13.1 Hard Rules & Invariants (Non-Negotiable)

These are enforced by design and tests.
Execution Rules
❌ No admin UI can execute generation
❌ No API route can call generators
✅ Only the worker can run generators
✅ Worker consumes jobs by status transition
✅ Exactly-once semantics (idempotent execution)
✅ Insert-only outputs (no overwrites)
✅ Audit every execution lifecycle event
✅ No streaming, no partial writes
✅ Deterministic input → reproducible output
✅ Worker can crash/restart safely

Status State Machine (Authoritative)
PENDING
↓ (worker lock)
RUNNING
↓ success
COMPLETED

RUNNING
↓ failure
FAILED

❌ No transitions backward
❌ No re-run of COMPLETED or FAILED jobs
❌ No admin mutation except trigger → PENDING

13.2 System Architecture
┌────────────────────────┐
│ Admin UI (Phase 12) │
│ - Trigger only │
│ - Read-only │
└──────────┬─────────────┘
│
▼
┌────────────────────────┐
│ RegenerationJob (DB) │
│ status=PENDING │
└──────────┬─────────────┘
│
▼
┌──────────────────────────────┐
│ Regeneration Worker (Phase13)│
│ - Polls DB │
│ - Locks job │
│ - Executes generator │
│ - Writes output │
│ - Audits lifecycle │
└──────────────────────────────┘

13.3 Prisma Changes (If Needed)
13.3.1 RegenerationJob (already exists)

Ensure fields exist:

model RegenerationJob {
id String @id @default(cuid())
status RegenerationJobStatus
instructionJson Json
outputRef String?
errorJson Json?
lockedAt DateTime?
completedAt DateTime?
createdAt DateTime @default(now())
}

No new mutable fields beyond status + refs.

13.4 Worker Responsibilities
Worker MUST:

Poll for PENDING jobs
Atomically lock (status=RUNNING, lockedAt=now)
Execute generator based on instructionJson
Store output immutably
Update outputRef
Mark COMPLETED or FAILED
Emit audit events

Worker MUST NOT:
Accept HTTP requests
Read session/user context
Modify existing outputs
Retry failed jobs automatically
Modify instructions

13.5 Execution Model
Job Claim (Atomic)
UPDATE RegenerationJob
SET status='RUNNING', lockedAt=now()
WHERE id=? AND status='PENDING'
If affected rows = 0 → skip

Idempotency
Job can only be locked once
OutputRef written once
Re-runs must be no-ops

13.6 Generator Interface (Strict)
All generators must conform to:
export interface RegenerationExecutor {
type: RegenerationJobType
run(input: InstructionJson): Promise<ExecutionResult>
}
No generator registry exposed to UI or APIs.

13.7 Output Storage
Options (Choose One)
Local filesystem (dev)
S3 / blob store (prod)

Rules
Output paths must be deterministic
OutputRef is immutable
No overwrites allowed

13.8 Audit Events (Mandatory)
Event
REGEN_JOB_LOCKED
REGEN_JOB_STARTED
REGEN_JOB_COMPLETED
REGEN_JOB_FAILED

Audit must be:
Fire-and-forget
Non-blocking
Include jobId + status

13.9 Failure Handling
Failures:
Generator throws
Output write fails
Validation fails

Behavior:
Mark job FAILED
Write errorJson
Do NOT retry

Do NOT rollback previous outputs

13.10 Testing Strategy

- Required Tests
- 1Worker claims PENDING job
- Completed job not re-run
- Failed job not re-run
- Exactly-once output creation
- Audit events emitted

Crash recovery (lock prevents double run)

## 🧠 COPILOT PROMPTS (BROKEN DOWN, SAFE)

🔹 Copilot Prompt 13.A — Worker Skeleton
Create a new regeneration worker module that runs independently
from API routes and UI.

Requirements:

- Location: /workers/regenerationWorker.ts
- No HTTP imports
- No Next.js imports
- No session/auth imports

Behavior:

- Poll RegenerationJob where status = 'PENDING'
- Process jobs sequentially (no concurrency yet)
- Do not implement generator logic yet

Include:

- startWorker()
- processNextJob()
- claimJob(jobId)

Do NOT:

- Call any generator
- Modify schemas
- Import admin/UI code

## 🔹 Copilot Prompt 13.B — Job Locking Logic

Implement atomic job locking for RegenerationJob.

Task:

- Update claimJob(jobId) to:
  - Transition status PENDING → RUNNING
  - Set lockedAt = now()
  - Return null if already locked

Rules:

- Use Prisma updateMany or equivalent
- Ensure exactly-once semantics
- Add unit tests for:
  - Successful claim
  - Double-claim prevention

## 🔹 Copilot Prompt 13.C — Generator Interface

Define a strict RegenerationExecutor interface.

Requirements:

- Interface only, no implementations
- Located in /regeneration/executor.ts
- run(input) returns ExecutionResult
- No side effects
- No DB access inside interface

Do NOT:

- Implement generators
- Import worker code

## 🔹 Copilot Prompt 13.D — Execution + Output Write

Extend regenerationWorker to execute a generator
after locking a job.

Tasks:

1. Read instructionJson
2. Select generator by type
3. Run generator
4. Persist output to storage
5. Write outputRef to job
6. Mark COMPLETED

Rules:

- OutputRef written exactly once
- No overwrite allowed
- Catch errors and mark FAILED
- Write errorJson on failure

## 🔹 Copilot Prompt 13.E — Audit Wiring

Add non-blocking audit logging to the regeneration worker.

Events:

- REGEN_JOB_LOCKED
- REGEN_JOB_STARTED
- REGEN_JOB_COMPLETED
- REGEN_JOB_FAILED

Rules:

- Fire-and-forget logging
- Never throw from audit
- Include jobId and status
- Reuse existing logAuditEvent helper

## 🔹 Copilot Prompt 13.F — Worker Tests

Add unit tests for regenerationWorker.

Test cases:

1. PENDING job is claimed and completed
2. COMPLETED job is skipped
3. FAILED job is skipped
4. Double execution prevented
5. Output written once
6. Audit events emitted

Rules:

- Use test DB
- No real generators (mock executor)
- No filesystem writes (mock storage)

🔚 Phase 13 Exit Criteria

You may declare Phase 13 complete only when:

✅ Worker runs without UI/API coupling
✅ Jobs execute exactly once
✅ Outputs are immutable
✅ Audit trail is complete
✅ Tests enforce invariants

# Detailed summary of Phase 13 implementation

## What was intended

Introduce an isolated, headless execution plane (worker-only) that materializes RegenerationJob → immutable RegenerationOutput.
Enforce control-plane ≠ execution-plane: admin UI / API can only trigger jobs (PENDING), never run generators.
Exactly-once semantics via atomic claim (PENDING → RUNNING with lockedAt), deterministically run generator, persist immutable output, write outputRef once, mark COMPLETED or FAILED.
Emit non-blocking audit events at lifecycle points: REGEN_JOB_LOCKED, REGEN_JOB_STARTED, REGEN_JOB_COMPLETED, REGEN_JOB_FAILED.
Provide a strict RegenerationExecutor interface for generators, and comprehensive unit + DB-backed tests enforcing invariants.

## What was completed

executor.ts: added strict RegenerationExecutor interface and ExecutionResult types (generator contract).
regenerationWorker.ts: implemented worker with:
processNextJob() and claimJob() using transactional/atomic semantics (PENDING → RUNNING, set lockedAt).
Generator invocation handshake (via adapter), persisting immutable RegenerationOutput, deterministic outputRef.
Atomic finalization using guarded updateMany (only transition RUNNING → COMPLETED/FAILED).
Non-blocking audit calls (logAuditEvent) at LOCKED / STARTED / COMPLETED / FAILED.
Safe error handling: write errorJson and mark FAILED; no retries, no partial streaming.
regenerationJobRunner.ts: aligned runner semantics with worker (advisory lock-style, guarded updates).

## Tests added/updated:

Unit tests for claim semantics, process flow, execution success/failure behavior, audit emission (mocks).
DB-backed integration tests with quick DB-reachability checks (fail-fast if DATABASE_URL unreachable).
Adjusted Phase 11/12 tests to avoid schema-coupling (explicit select) and to increase reliability/timeouts.
CI/dev hygiene:
Ran prisma generate as needed; resolved "@prisma/client not initialized" issues.
Fixed TypeScript/lint issues (removed debug console statements, corrected mock shapes).
Full verification completed: ESLint, tsc and Jest passed (final run reported green).

## What is pending

Production object storage integration (S3 / blob) for outputs — current implementation supports deterministic local storage options; S3 integration is optional/left to be chosen.
Formal PR/merge step and review (branching/commit polish, changelog/PR description).
Optional: broaden E2E tests that exercise real generators + real object storage to validate full production flow (currently generator implementations are mocked in tests).
Optional hardening: operational telemetry for worker (metrics, backoff behavior, visibility dashboards) beyond audit logs.
If your production DB schema differs (e.g., fields like lockedAt missing), ensure migrations are applied in target environments — some tests were made resilient, but production migration must be validated.

## Suggestions

Integrate production object storage (S3/Blob) for outputs now — implement a deterministic path strategy and a small adapter behind an interface used by the worker; add integration tests that point at a test bucket.
Open a focused PR containing:
Summary of invariants (link Phase_13.md), changed files, tests added, and verification results.
Migration notes (ensure lockedAt, outputRef, errorJson fields present).
Add light observability:
Worker metrics (jobs processed, failures, claim latency) exported to your metrics system.
Alerts for repeated failures or claim saturation.
Add a short-runbook in docs describing worker lifecycle, how to restart safely, and how to inspect audit logs for a job.
If you want, I can:
Create the PR with a concise description and commit history.
Implement the S3 output adapter + tests.
Add basic Prometheus metrics hooks and a runbook doc.
Would you like me to open the PR now or implement S3 output storage next?

## 📘 PHASE 14 — REGENERATION GOVERNANCE & RETRY CONTROL

# 1. Phase 14 — Purpose & Positioning

Why Phase 14 exists

By the end of Phase 13, the system can:

- Execute regeneration jobs exactly once
- Produce immutable outputs
- Separate control plane (admin/UI) from execution plane (worker)

However, the system is currently terminal:

- FAILED jobs cannot be retried
- COMPLETED jobs cannot be superseded
- Admins can observe failures but not govern recovery

Phase 14 introduces human-governed recovery without breaking:

- Immutability
- Auditability
- Execution isolation
- Determinism

# 2. Core Principles (Non-Negotiable)

Phase 14 MUST preserve all of these:

- No mutation of existing jobs or outputs
- Retries create new lineage, never reuse
- Admins approve intent, workers execute
- Retry is explicit, audited, and reasoned
- No generators run from APIs or UI
- Every retry is explainable post-hoc
  If any of these are violated → Phase 14 is incorrect.

# 3. High-Level Concept

Introduce a new first-class concept: RetryIntent

A RetryIntent is:
An admin-created, audited declaration:

- “I want this failed job to be retried, for this reason, under these constraints.”
  It does not:
- Execute generators
- Modify jobs
- Modify outputs
  It simply authorizes the system to create a new RegenerationJob.

# 4. New Domain Objects

## 4.1 RetryIntent (NEW)

RetryIntent {
id
sourceJobId // original FAILED job
sourceOutputRef? // optional, if output exists
reasonCode // enum
reasonText // admin explanation
approvedBy // admin user id
approvedAt
status // PENDING | CONSUMED | REJECTED
createdAt
}

Invariants
Insert-only
Status can only move forward
One RetryIntent can only be consumed once

## 4.2 RegenerationJob (EXTENSION)

Add lineage fields (no behavior change):
retryOfJobId? // points to original job
retryIntentId? // points to RetryIntent

Invariant
retryOfJobId is immutable
retryIntentId must be unique per job

## 5. Lifecycle Flow (Authoritative)

FAILED Job
↓
Admin reviews failure
↓
Admin creates RetryIntent (audited)
↓
System creates NEW RegenerationJob (PENDING)
↓
Worker claims & executes (Phase 13 rules)
↓
New RegenerationOutput (immutable)

At no point:
Is the original job modified
Is the original output overwritten

## 6. Phase 14 Sub-Phases

🔹 Phase 14.1 — Prisma Schema Changes
What we add
RetryIntent model
Extend RegenerationJob with lineage fields
Unique constraints for idempotency
What we do NOT add
No retry counters
No status resets
No cascading deletes

### Copilot Prompt — Phase 14.1 (Schema)

Copilot Prompt (run alone):

Add Phase 14 regeneration governance models.

Tasks:
Update schema.prisma:
Add model RetryIntent with fields:
id (cuid)
sourceJobId (string)
sourceOutputRef (string?, nullable)
reasonCode (enum RetryReasonCode)
reasonText (string)
approvedBy (string)
approvedAt (DateTime)
status (enum RetryIntentStatus)
createdAt (DateTime @default(now()))

Add enums:
RetryIntentStatus = PENDING | CONSUMED | REJECTED
RetryReasonCode = TRANSIENT_FAILURE | BAD_INPUT | IMPROVED_PROMPT | INFRA_ERROR | OTHER

Extend RegenerationJob:
Add retryOfJobId (string?, immutable)
Add retryIntentId (string?, unique)
Do NOT modify existing fields or behavior.

Generate Prisma client.

Do not write APIs or business logic yet.

## 🔹 Phase 14.2 — RetryIntent Store Layer

Purpose

- Centralize persistence
- Enforce idempotency
- Emit audit events

Required Functions
createRetryIntent(...)
consumeRetryIntent(...)
listRetryIntentsForJob(jobId)

Invariants
Only FAILED jobs allowed
Only admin callers
Consumed intents cannot be reused

### Copilot Prompt — Phase 14.2 (Store)

Copilot Prompt:

Implement the RetryIntent persistence layer.

Tasks:
Create lib/retryIntent/store.ts.

Implement:
createRetryIntent(input)
Validate source job exists and is FAILED
Insert RetryIntent with status=PENDING
Emit audit event RETRY_INTENT_CREATED (non-blocking)
consumeRetryIntent(id, tx)
Transition status PENDING → CONSUMED using guarded update
Throw if already consumed

Ensure:
Insert-only semantics
No generator imports
Prisma access via injected client

Add unit tests covering:
Cannot retry non-FAILED job
Idempotency on consume

Do not add APIs or UI.

## 🔹 Phase 14.3 — Retry Job Creation Service

Purpose

Convert a RetryIntent into a new RegenerationJob

Key Rule
This is job creation, not execution.

### Copilot Prompt — Phase 14.3 (Service)

Copilot Prompt:

Implement retry job creation from RetryIntent.

Tasks:
Create lib/regeneration/retryService.ts.

Implement createRetryJobFromIntent(intentId):
Run inside a DB transaction
Consume RetryIntent (PENDING → CONSUMED)

Create new RegenerationJob:
status = PENDING
retryOfJobId = sourceJobId
retryIntentId = intentId
Emit audit event REGEN_JOB_RETRIED

Enforce:
Exactly one job per RetryIntent
No mutation of original job

Add unit tests for:
Double execution blocked
Transactional safety

Do not touch worker code.

## 🔹 Phase 14.4 — Admin APIs

APIs (Admin-only)
POST /api/admin/retry-intents
POST /api/admin/retry-intents/:id/execute
GET /api/admin/retry-intents?jobId=

Guards
Admin auth
FAILED job only
No generator calls

### Copilot Prompt — Phase 14.4 (APIs)

Copilot Prompt:
Add admin APIs for RetryIntent governance.

Tasks:

Create admin routes:
POST create retry intent
POST execute retry intent (creates new job)
GET list retry intents for job

Enforce:
Admin-only access
Source job must be FAILED
Execute endpoint calls retryService only

Emit audit events:
RETRY_INTENT_CREATED
RETRY_INTENT_EXECUTED

Add API tests for:
Unauthorized access
Double execution blocked

Do not modify worker or generator code.

## 🔹 Phase 14.5 — Admin UI

Pages

Failed Job Detail → “Retry” section
RetryIntent list with status
RetryIntent detail (read-only)
“Execute Retry” button

### Copilot Prompt — Phase 14.5 (UI)

Copilot Prompt:
Build admin UI for RetryIntent governance.

Tasks:
Add RetryIntent section to failed job detail page.

Display:
reason
status
approvedBy / approvedAt

Add Execute button:
Calls POST execute endpoint
Disabled if status != PENDING

UI must be:
Read-only
Server-rendered where possible
Reuse ReadOnlyJsonViewer for evidence.

Do not allow edits or deletes.

## 🔹 Phase 14.6 — Tests & Invariant Enforcement

Required Tests

RetryIntent idempotency
Job lineage correctness
Worker executes retried job normally
Original output untouched

### Copilot Prompt — Phase 14.6 (Tests)

Copilot Prompt:

Add Phase 14 invariant tests.

Tasks:

Add tests asserting:
Retried job produces new output
Original job/output unchanged
RetryIntent cannot be reused

Add regression test:
No generator imports in admin APIs
Ensure full test suite passes.
Do not weaken existing Phase 13 tests.

✅ Phase 14 Completion Criteria

Phase 14 is DONE when:
RetryIntent exists and is audited
New jobs are created via retry, not mutation
Worker executes retried jobs unchanged
Admin has visibility and control
All invariants are enforced by tests

# What Was Intended (Phase 14)

## Goal: Add human-governed, auditable retry control without changing execution-plane invariants.

New concept: RetryIntent — an admin-created, insert-only intent that authorizes creating a new RegenerationJob.
Schema changes: Add RetryIntent model + enums (RetryIntentStatus, RetryReasonCode); extend RegenerationJob with retryOfJobId and retryIntentId.
Store/service: Provide a store to create/consume/list intents and a service to atomically consume an intent and create a new job (transactional, idempotent).
APIs: Admin-only routes to create/list/execute intents (no generator calls in APIs).
Invariants: No mutation of existing jobs/outputs; retries create new jobs; single-consumption of an intent; full audit trail.

## What We Accomplished

Schema: Updated schema.prisma with enums and RetryIntent model; added lineage fields to RegenerationJob; created migrations and applied them to DB.
Persistence: Implemented store.ts with createRetryIntent, consumeRetryIntent, listRetryIntentsForJob and unit tests enforcing FAILED-job guard and consume idempotency.
Service: Implemented retryService.ts with transactional createRetryJobFromIntent (consume intent → create new RegenerationJob) and unit tests (double-execution blocked, transactional safety).
APIs: Added admin routes:
POST /api/admin/retry-intents — create intent (admin-only, audited).
POST /api/admin/retry-intents/:id/execute — execute intent (calls retry service).
GET /api/admin/retry-intents?jobId= — list intents for a job.
Tests ensure admin-guard and idempotency; regression test added to assert admin APIs do not import generators.
Worker safety: Kept Phase 13 worker semantics unchanged.
Tests: Added Phase 14 invariant tests (lineage, original outputs unchanged, idempotency) and many unit/integration tests; full local test suite now passes.
Migrations & Client: Created migration files and successfully ran npx prisma migrate deploy and npx prisma generate against the configured DB.

## What Is Still Pending

CI/Test DB sync: Ensure CI and all test environments apply the new migrations (we ran migrate deploy locally — CI must do the same).
End-to-end DB-backed integration coverage: Add or expand E2E tests that exercise full admin → execute → worker end-to-end on CI (some DB-backed tests were added and pass locally).
Admin UI: Phase 14 UI pages (failed-job Retry section, intent list/detail, execute button) remain to be implemented.
Observability/metrics: Optional: add metrics/alerts for retry intent creation/consumption and job retries.
Deployment checklist: Communicate migration window, backups, and rollout plan for production (required before deploy).

## Suggestions

CI: Add a migration step to CI pipeline that runs npx prisma migrate deploy before tests/build to keep DB in sync. Example:
Audit & Monitoring: Emit metrics for RETRY_INTENT_CREATED / RETRY_INTENT_CONSUMED and alert on unusual retry rates (surge → investigation).
UI UX guardrails: Implement read-only admin UI with clear reason/approvedBy fields and a disabled/confirm modal for execute (force admin confirmation and require reason text).
Operational: Document migration and rollback steps in WORKFLOWS.md and add a short runbook entry for retry governance operations.
Security: Ensure admin APIs are RBAC-guarded and audit logs include actor, IP, and request context.
Would you like me to:

## Next steps

Add the CI migration step to the repo (CI config), or
Scaffold the admin UI pages for RetryIntents, or
Open a PR with a summary and migration notes?

# Open AI Feedback

This is a very strong Phase 14 outcome — Copilot executed it correctly and, importantly, did not violate any execution-plane or immutability guarantees. Well done.

Now let me answer clearly and decisively what comes next and what you should instruct Copilot to do, in the right order, without rework.

First: Is Phase 14 “functionally complete”?

Backend & governance: ✅ YES
Operationally shippable: ⚠️ Almost
Admin-usable end-to-end: ❌ Not yet (UI missing)

Phase 14 is architecturally complete, but not operationally usable by humans until the admin UI exists and CI is migration-safe.

So the next steps are not new features, but Phase 14 hardening + completion.

What to do next (Correct Order)
✅ Step 1 (MANDATORY): Add CI Prisma migration step
✅ Step 2 (MANDATORY): Implement Admin UI for RetryIntents
🔶 Step 3 (OPTIONAL but recommended): Minimal observability
⏭️ Only then move to Phase 15

I’ll give you Copilot-ready instructions for Step 1 and Step 2, broken down cleanly.

🔹 STEP 1 — CI Prisma Migration Sync (DO THIS FIRST)
Why this must be first
You already changed the schema
CI must never run tests against an old DB
Otherwise Phase 14 becomes fragile and non-repeatable
What success looks like
CI runs prisma migrate deploy before tests
No schema drift between local / CI / prod

🧠 Copilot Prompt — CI Migration Step

Copilot Prompt (run alone):

Update CI pipeline to apply Prisma migrations before tests.

Tasks:
Locate the CI workflow(s) that run tests/build (GitHub Actions or equivalent).

Before running tests:
Add step: npx prisma migrate deploy
Ensure DATABASE_URL is available (use existing CI secrets).

Ensure order is:
install deps
prisma generate
prisma migrate deploy
tests / build
Do NOT add migrate dev to CI.
Update CI comments or README if needed.
Goal: CI DB schema always matches repo schema.

✅ Commit this as something like:
chore(ci): apply prisma migrations before tests

## 🔹 STEP 2 — Admin UI for RetryIntents (Phase 14 UI Completion)

This is the last missing core deliverable of Phase 14.
You already did this pattern in Phase 12 and Phase 11 — reuse it.

### 2.1 UI Scope (STRICT)

Pages to build
RetryIntents List (per Job)
RetryIntent Detail
Execute Retry Button
Explicitly forbidden
❌ Edit RetryIntent
❌ Delete RetryIntent
❌ Run generators
❌ Modify jobs directly

2.2 Page Breakdown
A) Failed Job Detail → Retry Section

Shows
Existing RetryIntents
Status badge (PENDING / CONSUMED / REJECTED)
ReasonCode + ReasonText
ApprovedBy / ApprovedAt
Actions
“Create Retry Intent” (modal/form)
“Execute Retry” (only if PENDING)

B) RetryIntent Detail Page
Read-only
Full RetryIntent JSON (via ReadOnlyJsonViewer)
Linked sourceJobId
Status
Audit trail (if available)

### 2.3 Copilot Prompt — RetryIntent List UI

Implement admin UI list for RetryIntents.
Tasks:
Add a server-rendered admin page:
Route: /admin/jobs/[jobId]/retry-intents
Fetch retry intents via existing admin API.
Display table with:
id
status
reasonCode
approvedBy
approvedAt
Add link to RetryIntent detail page.
Page must be:
Admin-only
Read-only
Do not add any mutation logic yet.

### 2.4 Copilot Prompt — Create RetryIntent Form

Add UI to create a RetryIntent from a FAILED job.
Tasks:
Add a form/modal on failed job detail page.
Fields:
reasonCode (select enum)
reasonText (required textarea)
Submit to POST /api/admin/retry-intents.
On success:
Refresh list
Show confirmation
Enforce:
Disabled if job is not FAILED
Admin-only
Do not allow editing after creation.

### 2.5 Copilot Prompt — Execute Retry Button

Add Execute Retry button for RetryIntent.
Tasks:
On RetryIntent detail page:
Show Execute button if status === PENDING.
Button behavior:
Confirmation dialog explaining:
“This will create a new regeneration job.”
On confirm:
POST /api/admin/retry-intents/:id/execute
On success:
Redirect to new RegenerationJob detail
Disable button if status != PENDING.
Do not run generators or call worker code.

### 2.6 Copilot Prompt — RetryIntent Detail Page

Implement RetryIntent detail admin page.
Tasks:
Server-render page at:
/admin/retry-intents/[id]

Display:
Metadata fields
Status badge
Source job link
Render full RetryIntent JSON using ReadOnlyJsonViewer.
Include Execute button (from previous step).
No edits, no deletes.

✅ Phase 14 Completion Checklist (Final)

Phase 14 is DONE when:

- RetryIntent schema + migration exists
- Store + service enforce idempotency
- APIs are admin-only and audited
- Worker unchanged
- CI applies migrations
- Admin UI allows humans to govern retries
- After Step 2 → Phase 14 is fully closed.

What Comes Next (Preview)

- Once Phase 14 UI is done, the system now supports:
- Observation → Signal → Suggestion → Retry → Execution → New Output
  That unlocks Phase 15:
