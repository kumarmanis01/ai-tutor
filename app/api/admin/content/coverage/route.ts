/**
 * GET /api/admin/content/coverage
 *
 * Returns a content-coverage matrix: every ClassLevel × SubjectDef row with
 * live question count, RAG chunk count, and the latest HydrationJob status.
 *
 * Auth: admin role required (same pattern as all admin routes).
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET() {
  // session check → role check → business logic (CLAUDE.md rule 8)
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  try {
    // Fetch all active ClassLevel + SubjectDef rows in one query
    const classLevels = await prisma.classLevel.findMany({
      where: { lifecycle: 'active' },
      include: {
        board: { select: { name: true, slug: true } },
        subjects: {
          where: { lifecycle: 'active' },
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ board: { slug: 'asc' } }, { grade: 'asc' }],
    })

    // Collect all subjectIds for batch queries
    const subjectIds = classLevels.flatMap((cl) => cl.subjects.map((s) => s.id))

    // Batch 1: latest HydrationJob per subjectId (root jobs only, jobType=syllabus)
    const latestJobs = await prisma.hydrationJob.findMany({
      where: {
        subjectId: { in: subjectIds },
        rootJobId: null, // rootJobId is null OR equals own id for root jobs
      },
      orderBy: { id: 'desc' }, // cuid ordering is insertion order
      select: {
        id: true,
        subjectId: true,
        status: true,
        lockedAt: true,
        completedAt: true,
        lastError: true,
      },
    })

    // Also fetch jobs where rootJobId = own id (the other root-job pattern)
    const latestJobsSelfRoot = await prisma.hydrationJob.findMany({
      where: {
        subjectId: { in: subjectIds },
        jobType: 'syllabus',
      },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        subjectId: true,
        status: true,
        lockedAt: true,
        completedAt: true,
        lastError: true,
      },
    })

    // Merge and keep latest per subjectId (latest by cuid desc = last inserted)
    const jobBySubject = new Map<string, (typeof latestJobsSelfRoot)[0]>()
    for (const j of [...latestJobs, ...latestJobsSelfRoot]) {
      if (!j.subjectId) continue
      if (!jobBySubject.has(j.subjectId)) {
        jobBySubject.set(j.subjectId, j)
      }
    }

    // Batch 2: question counts per subjectId via topic→chapter→subject chain
    const questionCounts = await prisma.question.groupBy({
      by: ['topicId'],
      where: {
        status: 'ACTIVE',
        topicId: { not: null },
      },
      _count: { id: true },
    })

    // Resolve topicId → subjectId via one query
    const topicIds = questionCounts.map((r) => r.topicId).filter(Boolean) as string[]
    const topics = topicIds.length
      ? await prisma.topicDef.findMany({
          where: { id: { in: topicIds } },
          select: {
            id: true,
            chapter: { select: { subjectId: true } },
          },
        })
      : []

    const topicToSubject = new Map(topics.map((t) => [t.id, t.chapter.subjectId]))
    const questionsBySubject = new Map<string, number>()
    for (const row of questionCounts) {
      if (!row.topicId) continue
      const sid = topicToSubject.get(row.topicId)
      if (!sid) continue
      questionsBySubject.set(sid, (questionsBySubject.get(sid) ?? 0) + row._count.id)
    }

    // Batch 3: CurriculumChunk counts -- matched by subject name + grade + board name
    // CurriculumChunk has no subjectId FK; uses string fields board/grade/subject.
    const chunkCounts = await prisma.curriculumChunk.groupBy({
      by: ['board', 'grade', 'subject'],
      _count: { id: true },
    })

    // Build a lookup: `${board}|${grade}|${subject}` → count
    const chunkLookup = new Map<string, number>()
    for (const row of chunkCounts) {
      if (!row.board || !row.grade || !row.subject) continue
      const key = `${(row.board ?? '').toLowerCase()}|${row.grade}|${(row.subject ?? '').toLowerCase()}`
      chunkLookup.set(key, (chunkLookup.get(key) ?? 0) + row._count.id)
    }

    // Assemble rows
    const rows = classLevels.flatMap((cl) =>
      cl.subjects.map((sub) => {
        const boardName = cl.board.slug.toLowerCase()
        const gradeStr = String(cl.grade)
        const subjectName = sub.name.toLowerCase()
        const chunkKey = `${boardName}|${gradeStr}|${subjectName}`
        const latestJob = jobBySubject.get(sub.id) ?? null

        return {
          board: cl.board.name,
          boardSlug: cl.board.slug,
          grade: cl.grade,
          subject: sub.name,
          subjectId: sub.id,
          language: 'en', // default display language; filtering by language is a future feature
          questionCount: questionsBySubject.get(sub.id) ?? 0,
          curriculumChunkCount: chunkLookup.get(chunkKey) ?? 0,
          latestJob: latestJob
            ? {
                id: latestJob.id,
                status: latestJob.status,
                startedAt: latestJob.lockedAt?.toISOString() ?? null,
                completedAt: latestJob.completedAt?.toISOString() ?? null,
                error: latestJob.lastError ?? null,
              }
            : null,
        }
      }),
    )

    logger.info('[admin/content/coverage] fetched', {
      event: 'coverage_fetched',
      context: { rowCount: rows.length, adminId: session.user?.id },
    })

    return NextResponse.json({ rows })
  } catch (err) {
    logger.error('[admin/content/coverage] error', {
      event: 'coverage_error',
      context: { error: String(err) },
    })
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 })
  }
}
