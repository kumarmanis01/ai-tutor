/**
 * FILE OBJECTIVE:
 * - Parent pause API: pause/unpause a linked child account.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-pause.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | invoke streakShield.consumeShield when pausing to protect streaks
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { formatErrorForResponse } from '@/lib/errorResponse'
import { consumeShield } from '@/lib/student/streakShield'

export const dynamic = 'force-dynamic'

/**
 * POST /api/parent/pause
 * Body: { studentId: string, action: 'pause'|'unpause', pausedUntil?: string|null, pauseReason?: string }
 */
export async function POST(req: Request) {
  const start = Date.now()

  try {
    const session = await getServerSessionForHandlers()
    const parentId = (session?.user as any)?.id
    if (!parentId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
      return res
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      const res = NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
      logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
      return res
    }

    const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : ''
    const action = body?.action === 'pause' ? 'pause' : body?.action === 'unpause' ? 'unpause' : ''
    const pausedUntilRaw = body?.pausedUntil
    const pauseReason = typeof body?.pauseReason === 'string' ? body.pauseReason.trim() : null

    if (!studentId) {
      const res = NextResponse.json({ error: 'studentId required' }, { status: 400 })
      logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
      return res
    }

    if (!action) {
      const res = NextResponse.json({ error: 'action required (pause|unpause)' }, { status: 400 })
      logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
      return res
    }

    // Ensure the parent-student link exists and is active
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { id: true, status: true },
    })

    if (!link || link.status !== 'active') {
      const res = NextResponse.json({ error: 'link_not_found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
      return res
    }

    if (action === 'pause') {
      const pausedUntil = pausedUntilRaw ? new Date(pausedUntilRaw) : null
      const updated = await prisma.parentStudent.update({
        where: { parentId_studentId: { parentId, studentId } },
        data: { isPaused: true, pausedUntil, pauseReason },
      })

      // Non-fatal audit log
      prisma.auditLog.create({
        data: {
          adminId: parentId,
          targetEntity: 'ParentStudent',
          targetId: updated.id,
          action: null,
          details: { action: 'pause', pausedUntil: pausedUntil ? pausedUntil.toISOString() : null, pauseReason },
        },
      }).catch(() => {})

      // Try to consume streak shield to preserve streaks for the pause period (non-fatal)
      consumeShield(studentId).catch((err) => {
        logger.warn('streak shield consume failed during pause', { studentId, err: String(err) })
      })

      const res = NextResponse.json({ ok: true, link: { id: updated.id, isPaused: updated.isPaused, pausedUntil: updated.pausedUntil, pauseReason: updated.pauseReason } })
      logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
      return res
    }

    // unpause
    const updated = await prisma.parentStudent.update({
      where: { parentId_studentId: { parentId, studentId } },
      data: { isPaused: false, pausedUntil: null, pauseReason: null },
    })

    prisma.auditLog.create({
      data: {
        adminId: parentId,
        targetEntity: 'ParentStudent',
        targetId: updated.id,
        action: null,
        details: { action: 'unpause' },
      },
    }).catch(() => {})

    const res = NextResponse.json({ ok: true, link: { id: updated.id, isPaused: updated.isPaused } })
    logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const formatted = formatErrorForResponse(err)
    const res = NextResponse.json({ error: formatted }, { status: 500 })
    logger.logAPI(req, res, { className: 'ParentPauseAPI', methodName: 'POST' }, start)
    return res
  }
}
