/**
 * POST /api/admin/content-engine/questions-rehyd
 *
 * Bulk re-hydrate questions for every active topic in a subject, across all
 * three difficulty levels (easy, medium, hard).
 *
 * Unlike /content/complete-pipeline (which skips topics that already have any
 * approved GeneratedTest), this endpoint uses force=true to enqueue new
 * question-generation jobs even when approved questions already exist.
 * Use this to top up topics that were generated under the old cap of 2
 * questions per difficulty, now that the cap has been raised to 10.
 *
 * Body: { subjectId: string, language?: string, questionsPerDifficulty?: number }
 * Auth: admin role required.
 * Returns: { enqueued: number, skipped: number, topicCount: number }
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration'
import { logger } from '@/lib/logger'

const DEFAULT_QUESTIONS_PER_DIFFICULTY = 10
const MAX_QUESTIONS_PER_DIFFICULTY = 10

export async function POST(req: Request) {
  // session check -> role check -> business logic (CLAUDE.md rule 8)
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: { subjectId?: unknown; language?: unknown; questionsPerDifficulty?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { subjectId, language = 'en', questionsPerDifficulty: rawQpd = DEFAULT_QUESTIONS_PER_DIFFICULTY } = body

  if (!subjectId || typeof subjectId !== 'string') {
    return NextResponse.json({ error: 'missing_fields', required: ['subjectId'] }, { status: 400 })
  }

  if (typeof language !== 'string' || !['en', 'hi'].includes(language)) {
    return NextResponse.json({ error: 'invalid_language', supported: ['en', 'hi'] }, { status: 400 })
  }

  const qpdNum = Number(rawQpd)
  if (!Number.isFinite(qpdNum) || !Number.isInteger(qpdNum) || qpdNum < 1) {
    return NextResponse.json(
      { error: 'invalid_questionsPerDifficulty', message: 'Must be a positive integer (1-10)' },
      { status: 400 },
    )
  }
  const questionsPerDifficulty = Math.min(qpdNum, MAX_QUESTIONS_PER_DIFFICULTY)

  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      class: { select: { grade: true, board: { select: { name: true } } } },
    },
  })
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 })
  }

  const topics = await prisma.topicDef.findMany({
    where: {
      chapter: { subjectId, lifecycle: 'active' },
      lifecycle: 'active',
    },
    select: { id: true },
    orderBy: { order: 'asc' },
  })

  if (topics.length === 0) {
    return NextResponse.json({
      enqueued: 0,
      skipped: 0,
      topicCount: 0,
      message: 'No active topics found for this subject. Run the syllabus pipeline first.',
    })
  }

  let enqueued = 0
  let skipped = 0
  let hydrationPaused = false

  // One job per topic -- questionsWorker handles all 3 difficulties (easy/medium/hard) internally.
  // Do NOT enqueue one job per difficulty: that causes 3 workers to generate identical content
  // and upsert the same GeneratedTest rows concurrently.
  // force=true: generate new versions even for topics that already have approved questions.
  for (const topic of topics) {
    try {
      const result = await enqueueQuestionsHydration({
        topicId: topic.id,
        language,
        // difficulty is metadata only -- worker always generates all three levels
        difficulty: 'easy',
        questionsPerDifficulty,
        force: true,
      })
      if (result.created) {
        enqueued++
      } else {
        // With force=true, only skip reasons are job_already_queued or hydration_paused
        skipped++
        if (result.reason === 'hydration_paused') {
          hydrationPaused = true
          logger.warn('[questions-rehyd] hydration paused, aborting remaining topics', {
            event: 'questions_rehyd_paused',
            context: { subjectId, topicId: topic.id },
          })
          break
        }
      }
    } catch (err) {
      logger.warn('[questions-rehyd] failed to enqueue topic, skipping', {
        event: 'questions_rehyd_topic_error',
        context: { topicId: topic.id, error: String(err) },
      })
      skipped++
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        adminId: session.user?.id ?? null,
        targetEntity: 'HydrationJob',
        targetId: subjectId,
        action: 'CONTENT_HYDRATE',
        newValue: {
          operation: 'questions_rehydrate',
          subjectId,
          subjectName: subject.name,
          grade: subject.class?.grade,
          board: subject.class?.board?.name,
          language,
          questionsPerDifficulty,
          topicCount: topics.length,
          enqueued,
          skipped,
        },
      },
    })
  } catch (auditErr) {
    logger.warn('[questions-rehyd] failed to write AuditLog', {
      event: 'audit_log_failed',
      context: { subjectId, error: String(auditErr) },
    })
  }

  logger.info('[questions-rehyd] bulk questions re-hydration enqueued', {
    event: 'questions_rehyd_enqueued',
    context: {
      subjectId,
      subject: subject.name,
      grade: subject.class?.grade,
      language,
      questionsPerDifficulty,
      enqueued,
      skipped,
      adminId: session.user?.id,
    },
  })

  const pausedSuffix = hydrationPaused ? ' Stopped early -- hydration is paused.' : ''
  return NextResponse.json({
    enqueued,
    skipped,
    topicCount: topics.length,
    message: `Queued ${enqueued} question jobs (each covers easy/medium/hard)${skipped > 0 ? `, ${skipped} skipped (already queued or paused)` : ''}.${pausedSuffix}`,
  })
}
