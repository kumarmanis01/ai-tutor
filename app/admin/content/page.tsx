/**
 * /admin/content -- Content Coverage Dashboard
 *
 * Server component. Fetches coverage data from the internal API and renders
 * the interactive ContentTable client component.
 */
import { getServerSessionForHandlers } from '@/lib/session'
import { notFound } from 'next/navigation'
import ContentTable from './ContentActions'

async function fetchCoverageRows() {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    notFound()
  }

  // Import prisma directly -- we're in a server component, avoid extra round-trip
  const { prisma } = await import('@/lib/prisma')
  const { logger } = await import('@/lib/logger')

  try {
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

    const subjectIds = classLevels.flatMap((cl) => cl.subjects.map((s) => s.id))

    const [latestJobs, latestJobsSelfRoot, questionCounts, chunkCounts] = await Promise.all([
      prisma.hydrationJob.findMany({
        where: { subjectId: { in: subjectIds }, rootJobId: null },
        orderBy: { id: 'desc' },
        select: { id: true, subjectId: true, status: true, lockedAt: true, completedAt: true, lastError: true },
      }),
      prisma.hydrationJob.findMany({
        where: { subjectId: { in: subjectIds }, jobType: 'syllabus' },
        orderBy: { id: 'desc' },
        select: { id: true, subjectId: true, status: true, lockedAt: true, completedAt: true, lastError: true },
      }),
      prisma.question.groupBy({
        by: ['topicId'],
        where: { status: 'ACTIVE', topicId: { not: null } },
        _count: { id: true },
      }),
      prisma.curriculumChunk.groupBy({
        by: ['board', 'grade', 'subject'],
        _count: { id: true },
      }),
    ])

    // Merge latest job per subject
    const jobBySubject = new Map<string, (typeof latestJobs)[0]>()
    for (const j of [...latestJobs, ...latestJobsSelfRoot]) {
      if (!j.subjectId) continue
      if (!jobBySubject.has(j.subjectId)) jobBySubject.set(j.subjectId, j)
    }

    // Resolve topicId → subjectId
    const topicIds = questionCounts.map((r) => r.topicId).filter(Boolean) as string[]
    const topics = topicIds.length
      ? await prisma.topicDef.findMany({
          where: { id: { in: topicIds } },
          select: { id: true, chapter: { select: { subjectId: true } } },
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

    // Build chunk lookup
    const chunkLookup = new Map<string, number>()
    for (const row of chunkCounts) {
      if (!row.board || !row.grade || !row.subject) continue
      const key = `${row.board.toLowerCase()}|${row.grade}|${row.subject.toLowerCase()}`
      chunkLookup.set(key, (chunkLookup.get(key) ?? 0) + row._count.id)
    }

    return classLevels.flatMap((cl) =>
      cl.subjects.map((sub) => {
        const latestJob = jobBySubject.get(sub.id) ?? null
        return {
          board: cl.board.name,
          boardSlug: cl.board.slug,
          grade: cl.grade,
          subject: sub.name,
          subjectId: sub.id,
          language: 'en',
          questionCount: questionsBySubject.get(sub.id) ?? 0,
          curriculumChunkCount:
            chunkLookup.get(`${cl.board.slug.toLowerCase()}|${String(cl.grade)}|${sub.name.toLowerCase()}`) ?? 0,
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
  } catch (err) {
    logger.error('[admin/content] fetchCoverageRows failed', {
      event: 'coverage_fetch_error',
      context: { error: String(err) },
    })
    return []
  }
}

export default async function ContentPage() {
  const rows = await fetchCoverageRows()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Content Coverage</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Question counts, RAG chunks, and hydration job status per subject. Use the buttons to queue generation or
          trigger NCERT ingestion.
        </p>
      </div>
      <ContentTable rows={rows} />
    </div>
  )
}
