import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

export async function GET(req: Request, { params }: { params: { courseId: string; index: string } }) {
  const { courseId, index } = params
  const idx = Number(index)
  if (Number.isNaN(idx)) return NextResponse.json({ error: 'Invalid index' }, { status: 400 })

  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id ?? null

  const row = await db.coursePackage.findFirst({
     where: { syllabusId: courseId, status: 'PUBLISHED' },
     orderBy: { version: 'desc' }
  })

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { hasLearnerAccess } = await import('../../../../../../../lib/guards/access')
    const allowed = await hasLearnerAccess(db, userId, courseId, session?.user?.tenantId ?? null)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const pkg = row.json as any
  const lessons: any[] = []
  if (Array.isArray(pkg.modules)) {
    for (const m of pkg.modules) {
      if (Array.isArray(m.lessons)) {
        for (const l of m.lessons) lessons.push(l)
      }
    }
  }

  // Treat index as 1-based lessonIndex match first, else as array index (0-based)
  let found = lessons.find((l: any) => Number(l.lessonIndex) === idx)
  if (!found) found = lessons[idx]

  if (!found) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  // Learners must only see the promoted PublishedOutput. If none exists,
  // return 404 (not published).
  try {
    const { resolvePublishedOutputForScope } = await import('../../../../../../../lib/promotion/reader')
    const scopeRefIdCandidate = found.id ?? `${courseId}:${found.lessonIndex ?? idx}`
    const resolved = await resolvePublishedOutputForScope(db, 'LESSON', scopeRefIdCandidate)
    if (resolved && resolved.output && resolved.output.contentJson) {
      return NextResponse.json(resolved.output.contentJson)
    }
    return NextResponse.json({ error: 'Lesson not published' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Lesson not published' }, { status: 404 })
  }
}

export default GET
