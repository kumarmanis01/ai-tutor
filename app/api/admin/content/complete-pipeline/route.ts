/**
 * POST /api/admin/content/complete-pipeline
 *
 * Gap-fills a subject's content pipeline: enqueues notes jobs for topics that have no
 * approved notes, and question jobs for topics that have no active questions.
 * Safe to call on a partially-complete subject -- fully-complete topics are skipped.
 *
 * Body: { subjectId, board, grade, language? }
 * Auth: admin role required.
 * Returns: { ok: true, notesEnqueued: number, questionsEnqueued: number }
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { enqueueNotesHydration } from '@/lib/execution-pipeline/enqueueTopicHydration'
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration'
import { isSystemSettingEnabled } from '@/lib/systemSettings'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  // session check -> role check -> business logic (CLAUDE.md rule 8)
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  // Upfront HYDRATION_PAUSED guard -- fail fast with a clear message
  const pausedSetting = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } })
  if (isSystemSettingEnabled(pausedSetting?.value)) {
    return NextResponse.json(
      { error: 'hydration_paused', message: 'Hydration is globally paused (HYDRATION_PAUSED=true). Resume hydration in System Settings before enqueueing jobs.' },
      { status: 409 },
    )
  }

  let body: { subjectId?: string; board?: string; grade?: number; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { subjectId, language = 'en' } = body
  if (!subjectId) {
    return NextResponse.json({ error: 'missing_fields', required: ['subjectId'] }, { status: 400 })
  }

  // Verify subject exists
  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true },
  })
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 })
  }

  // Fetch all active topics for this subject
  const topics = await prisma.topicDef.findMany({
    where: {
      lifecycle: 'active',
      chapter: { lifecycle: 'active', subjectId },
    },
    select: { id: true },
  })

  if (topics.length === 0) {
    return NextResponse.json({ ok: true, notesEnqueued: 0, questionsEnqueued: 0, message: 'No topics found' })
  }

  const topicIds = topics.map(t => t.id)

  // Find topics that already have active notes
  const topicsWithNotes = new Set(
    (await prisma.topicNote.findMany({
      where: { topicId: { in: topicIds }, lifecycle: 'active' },
      select: { topicId: true },
      distinct: ['topicId'],
    })).map(r => r.topicId),
  )

  // Find topics that already have approved generated questions (GeneratedTest, not the legacy Question model)
  const topicsWithQuestions = new Set(
    (await prisma.generatedTest.findMany({
      where: { topicId: { in: topicIds }, status: 'approved' },
      select: { topicId: true },
      distinct: ['topicId'],
    })).map(r => r.topicId),
  )

  let notesEnqueued = 0
  let questionsEnqueued = 0

  for (const topic of topics) {
    if (!topicsWithNotes.has(topic.id)) {
      try {
        const result = await enqueueNotesHydration({ topicId: topic.id, language: language as 'en' | 'hi' })
        if (result.created) notesEnqueued++
      } catch (err) {
        logger.warn('[complete-pipeline] failed to enqueue notes job', {
          event: 'enqueue_notes_failed',
          context: { topicId: topic.id, error: String(err) },
        })
      }
    }

    if (!topicsWithQuestions.has(topic.id)) {
      try {
        const result = await enqueueQuestionsHydration({ topicId: topic.id, language: language as 'en' | 'hi', difficulty: 'medium' })
        if (result.created) questionsEnqueued++
      } catch (err) {
        logger.warn('[complete-pipeline] failed to enqueue questions job', {
          event: 'enqueue_questions_failed',
          context: { topicId: topic.id, error: String(err) },
        })
      }
    }
  }

  logger.info('[admin/content/complete-pipeline] gap-fill enqueued', {
    event: 'complete_pipeline_enqueued',
    context: { subjectId, notesEnqueued, questionsEnqueued, adminId: session.user?.id },
  })

  const message = notesEnqueued === 0 && questionsEnqueued === 0
    ? 'No new jobs created -- all topics already have content or active jobs queued.'
    : `Queued ${notesEnqueued} notes job${notesEnqueued !== 1 ? 's' : ''} and ${questionsEnqueued} questions job${questionsEnqueued !== 1 ? 's' : ''}. Workers will pick them up within 5 s.`

  return NextResponse.json({ ok: true, notesEnqueued, questionsEnqueued, message })
}
