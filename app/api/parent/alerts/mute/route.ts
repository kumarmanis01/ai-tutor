/**
 * FILE OBJECTIVE:
 * - Allow parent to mute automated alerts for a short duration (minutes/hours).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-alerts-mute.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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
