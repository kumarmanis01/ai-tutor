/**
 * FILE OBJECTIVE:
 * - Tokenized endpoint for muting inactivity alerts from parent email/SMS links.
 * - Verifies HMAC-signed mute tokens and atomically sets ParentStudent.isPaused + pausedUntil.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-mute.test.ts
 */

/**
 * FILE OBJECTIVE:
 * - Tokenized endpoint for muting inactivity alerts from parent email/SMS links.
 * - Verifies HMAC-signed mute tokens and atomically sets ParentStudent.isPaused + pausedUntil.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-mute.test.ts
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { verifyMuteToken, MuteTokenPayload } from '@/lib/parent/signedLink'
import { getServerSessionForHandlers } from '@/lib/session'
import { getRedis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

/**
 * GET /api/parent/alerts/mute?t=<token>
 * - token: HMAC-signed payload created by worker when composing alert
 * Behavior:
 * - verifies token, updates the ParentStudent link to paused state, creates an audit log
 * - redirects user to parent settings page with a success flag
 */
export async function GET(req: Request) {
  const start = Date.now()
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('t') || ''
    if (!token) {
      const res = NextResponse.json({ error: 'missing_token' }, { status: 400 })
      logger.logAPI(req, res, { className: 'ParentAlertsMute', methodName: 'GET' }, start)
      return res
    }

    const payload: MuteTokenPayload | null = verifyMuteToken(token)
    if (!payload) {
      const res = NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 400 })
      logger.logAPI(req, res, { className: 'ParentAlertsMute', methodName: 'GET' }, start)
      return res
    }

    const link = await prisma.parentStudent.findUnique({
      where: { id: payload.parentStudentId },
      select: { id: true, parentId: true, studentId: true, status: true },
    })

    if (!link || link.status !== 'active' || link.studentId !== payload.studentId) {
      const res = NextResponse.json({ error: 'link_not_found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'ParentAlertsMute', methodName: 'GET' }, start)
      return res
    }

    const pausedUntil = new Date(Date.now() + payload.muteDays * 24 * 60 * 60 * 1000)

    const updated = await prisma.parentStudent.update({
      where: { id: link.id },
      data: { isPaused: true, pausedUntil, pauseReason: 'muted_via_alert_link' },
    })

    // Audit the action as coming from the parent (adminId = parentId)
    prisma.auditLog
      .create({
        data: {
          adminId: link.parentId,
          targetEntity: 'ParentStudent',
          targetId: updated.id,
          action: null,
          details: { action: 'pause', pausedUntil: pausedUntil.toISOString(), pauseReason: 'muted_via_alert_link', via: 'alert_link' },
        },
      })
      .catch(() => {})

    const baseUrl = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'
    const redirectUrl = `${baseUrl}/parent/settings?muted=1&studentId=${encodeURIComponent(payload.studentId)}`
    const res = NextResponse.redirect(redirectUrl)
    logger.logAPI(req, res, { className: 'ParentAlertsMute', methodName: 'GET' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ParentAlertsMute', methodName: 'GET' }, start)
    logger.error('parent alerts mute failed', { error: String(err) })
    return res
  }
}

/**
 * POST /api/parent/alerts/mute
 * - Body: { minutes: number }
 * - Authenticated parent can mute all alerts for a short window (client-side preference).
 */
export async function POST(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const parentId = (session?.user as { id?: string })?.id
  if (!parentId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'ParentMuteAlertsAPI', methodName: 'POST' }, start)
    return res
  }

  const body = await req.json().catch(() => ({})) as any
  const minutes = Number(body.minutes ?? 0)
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) {
    const res = NextResponse.json({ error: 'invalid_minutes' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentMuteAlertsAPI', methodName: 'POST' }, start)
    return res
  }

  const redis = getRedis()
  if (!redis) {
    const res = NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: 'ParentMuteAlertsAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    const key = `parent:alerts:mute:${parentId}`
    await redis.setex(key, Math.ceil(minutes * 60), '1')
    const res = NextResponse.json({ ok: true })
    logger.logAPI(req, res, { className: 'ParentMuteAlertsAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('ParentMuteAlertsAPI failed', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ParentMuteAlertsAPI', methodName: 'POST' }, start)
    return res
  }
}
