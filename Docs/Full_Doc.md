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
  id: string
  syllabusId: string
  moduleId: string
  lessonIndex: number

  title: string
  durationMinutes: number

  objectives: string[]

  explanation: {
    overview: string
    concepts: {
      title: string
      explanation: string
      example?: string
    }[]
  }

  keyTakeaways: string[]

  practice: {
    prompt: string
    expectedOutcome: string
  }

  metadata: {
    level: "beginner" | "intermediate" | "advanced"
    prerequisites?: string[]
  }
}
```

Zod Schema

📄 lib/content/lesson/schema.ts

```ts
import { z } from "zod"

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
    concepts: z.array(
      z.object({
        title: z.string(),
        explanation: z.string().min(50),
        example: z.string().optional()
      })
    ).min(1)
  }),

  keyTakeaways: z.array(z.string()).min(2),

  practice: z.object({
    prompt: z.string().min(30),
    expectedOutcome: z.string().min(30)
  }),

  metadata: z.object({
    level: z.enum(["beginner", "intermediate", "advanced"]),
    prerequisites: z.array(z.string()).optional()
  })
})
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
`
}
```

Generator Logic

📄 generator.ts

```ts
const raw = await llm.generate(prompt)
const parsed = JSON.parse(raw)
const lessons = parsed.map(validateLesson)
return lessons
```

Notes:
- Do not implement generation logic yet — this section is the contract and prompt guidance only.

🟦 Phase 7.3 — Quiz Generator

🎯 Goal

Generate MCQs per lesson.

Quiz Schema (Simple & Safe)

```ts
export interface Quiz {
  lessonId: string
  questions: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
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
Risk	How Phase 7 avoids it
AI hallucinations	Schema + validation
Content drift	Versioning
Inconsistent quality	Fixed prompt contracts
Unreviewable output	Approval gates
Cost explosions	Deterministic generation

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
Phase	Purpose
7.6	Course Packaging (assemble approved content)
8.0	Persistence + Versioning
8.1	Publish API (read-only, immutable)
8.2	Regeneration + diffing
9.0	Delivery (UI, LMS, exports)

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
 + Approved Lessons
 + Approved Quizzes
 + Approved Projects
 --------------------------------
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
  id            String   @id @default(cuid())
  syllabusId    String
  version       Int

  status        CoursePackageStatus @default(PUBLISHED)

  /// Frozen JSON blob (validated before insert)
  json          Json

  createdAt     DateTime @default(now())

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

Rule	Where
Approved-only content	Builder (7.6)
Insert-only persistence	Store
Immutable JSON	DB + code
Versioned publishing	DB constraint
No mutation APIs	Routes
Audit preserved	Phase 7

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


```markdown
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


# 🧱 PART A — HELM / K8s PLAN FOR LEARNER SERVICES

## 🎯 Objective
Deploy learner-facing services in Kubernetes for:
- Read-only content delivery
- Scalable progress tracking (write-only progress APIs)
- Monetization safety
- Observability readiness for Phase 10

## 🧩 Services to Deploy

| Service     | Responsibility |
|-------------|----------------|
| learner-api | Phase 9 APIs (learn, progress, store) — stateless, horizontally scaled |
| admin-api   | Existing admin APIs (deployed separately) |
| evaluator   | Alerting/worker (Phase 5) |
| postgres    | External (Neon / RDS) |
| redis       | External (Upstash / ElastiCache) |
| pushgateway | Metrics bridge (Phase 10) |

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
- CI: run helm lint/template on PRs touching helm/**

---

##  — SUMMARY OF CHANGES (Phase 10A)
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

| Phase | Focus                         |
|-------|-------------------------------|
| 11    | Personalization (non-generative) |
| 12    | AI Tutor (safe, scoped)       |
| 13    | Marketplace & creators        |
| 14    | Adaptive learning             |

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

