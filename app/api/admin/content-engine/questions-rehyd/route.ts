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

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const DEFAULT_QUESTIONS_PER_DIFFICULTY = 10

export async function POST(req: Request) {
  // session check -> role check -> business logic (CLAUDE.md rule 8)
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: { subjectId?: string; language?: string; questionsPerDifficulty?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { subjectId, language = 'en', questionsPerDifficulty = DEFAULT_QUESTIONS_PER_DIFFICULTY } = body
  if (!subjectId) {
    return NextResponse.json({ error: 'missing_fields', required: ['subjectId'] }, { status: 400 })
  }

  if (!['en', 'hi'].includes(language)) {
    return NextResponse.json({ error: 'invalid_language', supported: ['en', 'hi'] }, { status: 400 })
  }

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

  // Enqueue serially (topic x difficulty) to avoid hammering the DB.
  // force=true: generate new versions even for topics that already have approved questions.
  for (const topic of topics) {
    for (const difficulty of DIFFICULTIES) {
      try {
        const result = await enqueueQuestionsHydration({
          topicId: topic.id,
          language,
          difficulty,
          questionsPerDifficulty,
          force: true,
        })
        if (result.created) {
          enqueued++
        } else {
          // With force=true, only skip reasons are job_already_queued or hydration_paused
          skipped++
          if (result.reason === 'hydration_paused') {
            logger.warn('[questions-rehyd] hydration paused, aborting', {
              event: 'questions_rehyd_paused',
              context: { subjectId, topicId: topic.id },
            })
            break
          }
        }
      } catch (err) {
        logger.warn('[questions-rehyd] failed to enqueue topic/difficulty, skipping', {
          event: 'questions_rehyd_topic_error',
          context: { topicId: topic.id, difficulty, error: String(err) },
        })
        skipped++
      }
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        adminId: session.user?.id ?? null,
        targetEntity: 'HydrationJob',
        targetId: subjectId,
        action: 'QUESTIONS_REHYDRATE',
        newValue: {
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

  return NextResponse.json({
    enqueued,
    skipped,
    topicCount: topics.length,
    message: `Queued ${enqueued} question jobs (easy/medium/hard)${skipped > 0 ? `, ${skipped} skipped (already queued or paused)` : ''}.`,
  })
}
