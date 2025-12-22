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