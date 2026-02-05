/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch available courses/subjects with chapters for the learn page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/learn/courses/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | refactored to use SubjectDef/ChapterDef instead of empty CoursePackage
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  // First try CoursePackage (published courses)
  const coursePackages = await db.coursePackage.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ syllabusId: 'asc' }, { version: 'desc' }]
  })

  if (coursePackages.length > 0) {
    const map = new Map<string, { courseId: string; title?: string; version: number; type: string }>()
    for (const r of coursePackages) {
      if (!map.has(r.syllabusId)) {
        map.set(r.syllabusId, { 
          courseId: r.syllabusId, 
          title: (r.json as any)?.title, 
          version: r.version,
          type: 'course'
        })
      }
    }
    return NextResponse.json(Array.from(map.values()))
  }

  // Fallback: Get subjects with their chapters from SubjectDef/ChapterDef
  const subjects = await db.subjectDef.findMany({
    where: {
      chapters: { some: { lifecycle: 'active' } }
    },
    include: {
      chapters: {
        where: { lifecycle: 'active' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true }
      }
    },
    orderBy: { name: 'asc' },
    distinct: ['name'] // Avoid duplicate subject names
  })

  // Group by unique subject name to avoid duplicates
  const uniqueSubjects = new Map<string, { courseId: string; title: string; chapterCount: number; type: string }>()
  for (const subject of subjects) {
    if (!uniqueSubjects.has(subject.name)) {
      uniqueSubjects.set(subject.name, {
        courseId: subject.id,
        title: subject.name,
        chapterCount: subject.chapters.length,
        type: 'subject'
      })
    }
  }

  return NextResponse.json(Array.from(uniqueSubjects.values()))
}

export default GET
