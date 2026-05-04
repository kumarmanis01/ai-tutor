/**
 * FILE OBJECTIVE:
 * - POST /api/student/revision/snooze
 * - AC-02 (F-STU-022): Student can snooze a revision card by 1 day only.
 *   Cannot permanently dismiss -- snooze pushes nextReviewAt by exactly 24 hours
 *   from now (not compounding from the original due date).
 * - Returns 404 when no StudentConceptState exists for (userId, conceptId).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/revision/snooze/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04 | staff-engineer | created for F-STU-022 AC-02 snooze requirement
 * - 2026-05-04T00:00:00Z | copilot | add full engineering practices header
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SNOOZE_MS = 24 * 60 * 60 * 1000 // exactly 1 day

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const authSession = await getServerSessionForHandlers()
    const userId = (authSession?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'RevisionSnoozeAPI', methodName: 'POST' }, start)
      return res
    }

    const body = await req.json().catch(() => null)
    const conceptId = typeof body?.conceptId === 'string' ? body.conceptId.trim() : null

    if (!conceptId) {
      const res = NextResponse.json(
        { error: 'conceptId (string) is required' },
        { status: 400 },
      )
      logger.logAPI(req, res, { className: 'RevisionSnoozeAPI', methodName: 'POST' }, start)
      return res
    }

    const state = await prisma.studentConceptState.findUnique({
      where: { studentId_conceptId: { studentId: userId, conceptId } },
      select: { conceptId: true },
    })

    if (!state) {
      const res = NextResponse.json({ error: 'Revision not found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'RevisionSnoozeAPI', methodName: 'POST' }, start)
      return res
    }

    // Snooze from now (not from the original due date) to avoid compounding snoozes.
    const base = new Date()
    const nextReviewAt = new Date(base.getTime() + SNOOZE_MS)

    await prisma.studentConceptState.update({
      where: { studentId_conceptId: { studentId: userId, conceptId } },
      data: { nextReviewAt },
    })

    logger.info('revision.snooze', {
      event: 'revision_snoozed',
      context: { studentId: userId, conceptId, nextReviewAt },
    })

    const res = NextResponse.json({ ok: true, nextReviewAt: nextReviewAt.toISOString() })
    logger.logAPI(req, res, { className: 'RevisionSnoozeAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('RevisionSnoozeAPI.error', { error: err })
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'RevisionSnoozeAPI', methodName: 'POST' }, start)
    return res
  }
}
