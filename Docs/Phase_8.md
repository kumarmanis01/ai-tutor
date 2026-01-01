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

