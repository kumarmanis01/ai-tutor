/**
 * POST /api/student/revision/complete
 *
 * Records completion of a revision card session for one concept.
 * Body: { conceptId: string, score: number }   // score = 0.0-1.0
 *
 * Side effects (all non-blocking / fire-and-forget):
 *   - Awards revision_complete XP (5 XP)
 *   - Calls trackRevisionAndMaybeUpdateStreak() to count toward streak
 *   - If score ≤ 0.8: enqueues a reteach LearningPlanItem via BullMQ
 *
 * Auth: session required -- 401 before any DB work.
 * Input: validated with zod-style manual checks -- 400 on bad input.
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'
import { awardXP } from '@/lib/student/xp'
import { trackRevisionAndMaybeUpdateStreak } from '@/lib/student/streak'
import { enqueueReteachPlan } from '@/jobs/reteachPlan'
import { addRevisionMinutes } from '@/lib/student/revisionCap'

export const dynamic = 'force-dynamic'

const RETEACH_SCORE_THRESHOLD = 0.8
const REVISION_XP = 5

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
