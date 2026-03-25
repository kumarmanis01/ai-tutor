/**
 * POST /api/admin/content/reset
 *
 * Deletes all AI-generated content for a subject:
 * GeneratedQuestion -> GeneratedTest -> TopicNote -> TopicDef -> ChapterDef
 * Then resets active HydrationJob flags.
 *
 * Body: { subjectId: string, confirmed?: boolean }
 * If confirmed is falsy, returns counts for the confirmation dialog.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: { subjectId?: string; confirmed?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { subjectId, confirmed } = body
  if (!subjectId) {
    return NextResponse.json({ error: 'missing_fields', required: ['subjectId'] }, { status: 400 })
  }

  // Confirm subject exists
  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true },
  })
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 })
  }

  // Get counts for confirmation dialog
  const [chapters, topics] = await Promise.all([
    prisma.chapterDef.count({ where: { subjectId, lifecycle: 'active' } }),
    prisma.topicDef.count({ where: { chapter: { subjectId }, lifecycle: 'active' } }),
  ])

  if (!confirmed) {
    return NextResponse.json({ ok: false, requiresConfirmation: true, counts: { chapters, topics } })
  }

  logger.info('[admin/content/reset] Resetting subject content', {
    event: 'content_reset_started',
    context: { subjectId, subjectName: subject.name, chapters, topics, adminId: session.user?.id },
  })

  // Delete in FK-safe order inside a transaction
  await prisma.$transaction([
    prisma.generatedQuestion.deleteMany({
      where: { test: { topic: { chapter: { subjectId } } } },
    }),
    prisma.generatedTest.deleteMany({
      where: { topic: { chapter: { subjectId } } },
    }),
    prisma.topicNote.deleteMany({
      where: { topic: { chapter: { subjectId } } },
    }),
    prisma.topicDef.deleteMany({
      where: { chapter: { subjectId } },
    }),
    prisma.chapterDef.deleteMany({ where: { subjectId } }),
    prisma.hydrationJob.updateMany({
      where: { subjectId, hierarchyLevel: 0 },
      data: {
        status: 'pending',
        contentReady: false,
        chaptersExpected: 0,
        chaptersCompleted: 0,
        topicsExpected: 0,
        topicsCompleted: 0,
        notesExpected: 0,
        notesCompleted: 0,
        questionsExpected: 0,
        questionsCompleted: 0,
        lastError: null,
        attempts: 0,
      },
    }),
  ])

  logger.info('[admin/content/reset] Reset complete', {
    event: 'content_reset_done',
    context: { subjectId, deleted: { chapters, topics } },
  })

  return NextResponse.json({ ok: true, deleted: { chapters, topics } })
}
