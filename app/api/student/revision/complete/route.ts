/**
 * POST /api/student/revision/complete
 *
 * Records completion of a revision card session for one concept.
 * Body: { conceptId: string, score: number }   // score = 0.0-1.0
 *
 * Side effects:
 *   - AC-04 (F-STU-022): Updates StudentConceptState.nextReviewAt via SM-18 based on score.
 *     Score > 0.8 = correct: stability increases, interval lengthens.
 *     Score <= 0.8 = wrong: stability halves, interval resets to 1 day.
 *   - Awards revision_complete XP (5 XP) -- fire-and-forget
 *   - Calls trackRevisionAndMaybeUpdateStreak() -- fire-and-forget
 *   - If score <= 0.8: enqueues a reteach LearningPlanItem via BullMQ -- fire-and-forget
 *   - AC-06: tracks ~2 min toward daily 20-min cap -- fire-and-forget
 *
 * Auth: session required -- 401 before any DB work.
 * Input: validated with zod-style manual checks -- 400 on bad input.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'
import { awardXP } from '@/lib/student/xp'
import { trackRevisionAndMaybeUpdateStreak } from '@/lib/student/streak'
import { enqueueReteachPlan } from '@/jobs/reteachPlan'
import { addRevisionMinutes } from '@/lib/student/revisionCap'
import { updateSM18 } from '@/lib/ai/tutor/sm18'

export const dynamic = 'force-dynamic'

const RETEACH_SCORE_THRESHOLD = 0.8
const REVISION_XP = 5
const MS_PER_DAY = 86400000

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const authSession = await getServerSessionForHandlers()
    const userId = (authSession?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'RevisionCompleteAPI', methodName: 'POST' }, start)
      return res
    }

    const body = await req.json().catch(() => null)
    const conceptId = typeof body?.conceptId === 'string' ? body.conceptId.trim() : null
    const score = typeof body?.score === 'number' && Number.isFinite(body.score)
      ? Math.min(1, Math.max(0, body.score))
      : null

    if (!conceptId || score === null) {
      const res = NextResponse.json(
        { error: 'conceptId (string) and score (number 0-1) are required' },
        { status: 400 },
      )
      logger.logAPI(req, res, { className: 'RevisionCompleteAPI', methodName: 'POST' }, start)
      return res
    }

    // AC-04 (F-STU-022): update SM-18 state immediately on revision completion.
    // Score > 0.8 treated as correct (interval grows); score <= 0.8 as wrong (interval resets).
    try {
      const state = await prisma.studentConceptState.findUnique({
        where: { studentId_conceptId: { studentId: userId, conceptId } },
        select: { stability: true, retention: true, lastInteraction: true },
      })
      if (state) {
        const now = new Date()
        const elapsedDays = (now.getTime() - state.lastInteraction.getTime()) / MS_PER_DAY
        const isCorrect = score > RETEACH_SCORE_THRESHOLD
        const sm18 = updateSM18({
          stability: state.stability,
          retention: state.retention,
          isCorrect,
          elapsedDays,
        })
        const nextReviewAt = new Date(now.getTime() + sm18.nextReviewInDays * MS_PER_DAY)
        await prisma.studentConceptState.update({
          where: { studentId_conceptId: { studentId: userId, conceptId } },
          data: {
            stability: sm18.newStability,
            retention: sm18.newRetention,
            memoryStrength: sm18.newRetention,
            nextReviewAt,
            lastInteraction: now,
          },
        })
      }
    } catch (err) {
      logger.error('RevisionCompleteAPI.sm18Update', { studentId: userId, conceptId, error: err })
      // non-fatal -- response still succeeds
    }

    // Fire-and-forget side effects -- none can fail the response.
    void awardXP({ studentId: userId, amount: REVISION_XP, source: 'revision_complete' })
    void trackRevisionAndMaybeUpdateStreak(userId)
    // AC-06 (F-STU-022): track ~2 min per revision concept toward daily 20-min cap
    void addRevisionMinutes(userId, 2)

    if (score <= RETEACH_SCORE_THRESHOLD) {
      void enqueueReteachPlan({ studentId: userId, conceptId })
    }

    logger.info('revision.complete', {
      event: 'revision_session_completed',
      context: { studentId: userId, conceptId, score },
    })

    const res = NextResponse.json({ ok: true }, { status: 200 })
    logger.logAPI(req, res, { className: 'RevisionCompleteAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('RevisionCompleteAPI.error', { error: err })
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'RevisionCompleteAPI', methodName: 'POST' }, start)
    return res
  }
}
