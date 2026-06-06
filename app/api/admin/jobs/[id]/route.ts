/**
 * GET /api/admin/jobs/[id]
 * Returns a HydrationJob with enriched subject/chapter/topic DB counts.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  try {
    const { id } = await params
    const job = await prisma.hydrationJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Resolve subject name + actual DB counts
    let subjectName: string | null = job.subject ?? null
    let boardName: string | null = job.board ?? null
    let actualChapters = 0
    let actualTopics = 0
    let actualNotes = 0
    let actualQuestions = 0

    if (job.subjectId) {
      const subject = await prisma.subjectDef.findUnique({
        where: { id: job.subjectId },
        include: {
          class: { include: { board: true } },
          chapters: {
            where: { lifecycle: 'active' },
            include: {
              topics: {
                where: { lifecycle: 'active' },
                select: { id: true },
              },
            },
          },
        },
      })
      if (subject) {
        subjectName = subject.name
        boardName = subject.class?.board?.name ?? null
        actualChapters = subject.chapters.length
        const topicIds = subject.chapters.flatMap((ch: any ) => ch.topics.map((t: any ) => t.id))
        actualTopics = topicIds.length

        if (topicIds.length > 0) {
          const [noteCount, questionCount] = await Promise.all([
            prisma.topicNote.count({ where: { topicId: { in: topicIds }, lifecycle: 'active' } }),
            // Count GeneratedTest rows -- the AI pipeline produces GeneratedTest, not Question records.
            prisma.generatedTest.count({ where: { topicId: { in: topicIds }, lifecycle: 'active' } }),
          ])
          actualNotes = noteCount
          actualQuestions = questionCount
        }
      }
    }

    // Fetch child jobs summary
    const childSummary = await prisma.hydrationJob.groupBy({
      by: ['status'],
      where: { rootJobId: job.id },
      _count: { id: true },
    })

    const childCounts = (childSummary as any[]).reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count.id
      return acc
    }, {})

    return NextResponse.json({
      job: {
        id: job.id,
        jobType: job.jobType,
        board: boardName ?? job.board,
        grade: job.grade,
        subject: subjectName,
        subjectId: job.subjectId,
        status: job.status,
        attempts: job.attempts,
        lastError: job.lastError,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        lockedAt: job.lockedAt,
        completedAt: job.completedAt,
        // Job-tracked progress (may be 0 if reconciler never ran)
        chaptersExpected: job.chaptersExpected,
        chaptersCompleted: job.chaptersCompleted,
        topicsExpected: job.topicsExpected,
        topicsCompleted: job.topicsCompleted,
        notesExpected: job.notesExpected,
        notesCompleted: job.notesCompleted,
        questionsExpected: job.questionsExpected,
        questionsCompleted: job.questionsCompleted,
        // Actual DB counts (source of truth)
        actualChapters,
        actualTopics,
        actualNotes,
        actualQuestions,
        // Child jobs
        childCounts,
      },
    })
  } catch (err) {
    logger.error('GET /api/admin/jobs/[id] error', { err })
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
