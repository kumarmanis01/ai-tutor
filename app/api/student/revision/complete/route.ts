/**
 * FILE OBJECTIVE:
 * - POST /api/student/revision/complete
 * - Records completion of a revision card session for one concept.
 * - AC-04 (F-STU-022): Updates SM-18 state (nextReviewAt, stability, retention,
 *   memoryStrength) immediately and synchronously. Returns 404 when no
 *   StudentConceptState exists (prevents XP farming with arbitrary conceptIds).
 *   SM-18 DB failure returns 500 -- state update is required, not optional.
 * - AC-06 (F-STU-022): Tracks ~2 min per card toward the 20-min daily cap.
 *
 * EDIT LOG:
 * - 2026-04-14 | copilot | created revision complete endpoint
 * - 2026-05-04 | staff-engineer | AC-04: add immediate SM-18 state update; 404 on
 *   missing state; 500 on SM-18 DB failure; align memoryStrength with sm18Worker
 *   formula (newRetention * masteryScore); fix misleading interval-reset comment
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

    // AC-04 (F-STU-022): load state first -- 404 if not found.
    // Prevents XP farming with arbitrary conceptIds and ensures SM-18 state exists
    // before any side effects are applied.
    const state = await prisma.studentConceptState.findUnique({
      where: { studentId_conceptId: { studentId: userId, conceptId } },
      select: { stability: true, retention: true, lastInteraction: true, masteryScore: true },
    })

    if (!state) {
      const res = NextResponse.json({ error: 'Revision state not found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'RevisionCompleteAPI', methodName: 'POST' }, start)
      return res
    }

    // AC-04 (F-STU-022): update SM-18 state immediately on revision completion.
    // Score > 0.8 = correct: stability increases, interval lengthens.
    // Score <= 0.8 = wrong: stability halves, shortening the next interval.
    // This is a required step -- DB failure returns 500.
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
    // memoryStrength: aligned with sm18Worker formula (newRetention * masteryScore).
    const memoryStrength = Math.round(sm18.newRetention * state.masteryScore * 1000) / 1000

    await prisma.studentConceptState.update({
      where: { studentId_conceptId: { studentId: userId, conceptId } },
      data: {
        stability: sm18.newStability,
        retention: sm18.newRetention,
        memoryStrength,
        nextReviewAt,
        lastInteraction: now,
      },
    })

    // Fire-and-forget side effects -- none can fail the response.
    void awardXP({ studentId: userId, amount: REVISION_XP, source: 'revision_complete' })
    void trackRevisionAndMaybeUpdateStreak(userId)
    // AC-06 (F-STU-022): track ~2 min per revision concept toward daily 20-min cap.
    void addRevisionMinutes(userId, 2)

    if (score <= RETEACH_SCORE_THRESHOLD) {
      void enqueueReteachPlan({ studentId: userId, conceptId })
    }

    logger.info('revision.complete', {
      event: 'revision_session_completed',
      context: { studentId: userId, conceptId, score, nextReviewInDays: sm18.nextReviewInDays },
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
