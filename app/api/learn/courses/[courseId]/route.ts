/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch a single course/subject with its chapters/lessons.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/learn/courses/courseId/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added fallback to SubjectDef when CoursePackage not found
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id ?? null

  // First try CoursePackage
  const courseRow = await db.coursePackage.findFirst({
    where: { syllabusId: courseId, status: 'PUBLISHED' },
    orderBy: { version: 'desc' }
  })

  if (courseRow) {
    const { hasLearnerAccess } = await import('../../../../../lib/guards/access')
    const allowed = await hasLearnerAccess(db, userId, courseId, session?.user?.tenantId ?? null)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json(courseRow.json)
  }

  // Fallback: Try SubjectDef by ID
  const subject = db.subjectDef ? await db.subjectDef.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        where: { lifecycle: 'active' },
        orderBy: { name: 'asc' },
        select: { 
          id: true, 
          name: true, 
          slug: true,
          lifecycle: true
        }
      }
    }
  }) : null

  if (subject) {
    // Transform to course-like structure with modules/lessons
    return NextResponse.json({
      type: 'subject',
      id: subject.id,
      title: subject.name,
      description: `Explore chapters in ${subject.name}`,
      modules: [{
        id: `${subject.id}-chapters`,
        title: 'Chapters',
        lessons: subject.chapters.map((chapter: any, index: number) => ({
          id: chapter.id,
          lessonIndex: index,
          title: chapter.name,
          slug: chapter.slug,
          objectives: [`Learn about ${chapter.name}`]
        }))
      }]
    })
  }

  // Try finding subject by name (in case courseId is a name)
  const subjectByName = db.subjectDef ? await db.subjectDef.findFirst({
    where: { 
      name: { equals: courseId, mode: 'insensitive' },
      chapters: { some: { lifecycle: 'active' } }
    },
    include: {
      chapters: {
        where: { lifecycle: 'active' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true }
      }
    }
  }) : null

  if (subjectByName) {
    return NextResponse.json({
      type: 'subject',
      id: subjectByName.id,
      title: subjectByName.name,
      description: `Explore chapters in ${subjectByName.name}`,
      modules: [{
        id: `${subjectByName.id}-chapters`,
        title: 'Chapters',
        lessons: subjectByName.chapters.map((chapter: any, index: number) => ({
          id: chapter.id,
          lessonIndex: index,
          title: chapter.name,
          slug: chapter.slug,
          objectives: [`Learn about ${chapter.name}`]
        }))
      }]
    })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export default GET
