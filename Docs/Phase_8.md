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
