/**
 * FILE OBJECTIVE:
 * - P1.3-R / P1.6-R: Deny a parent consent request by token.
 *   No auth required — parent clicks the deny link from email or mini-page.
 *   On success: ConsentRequest -> DENIED, logs the event.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/deny.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.3-R AC
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const start = Date.now()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    const res = NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ConsentDenyAPI', methodName: 'POST' }, start)
    return res
  }

  const b = body as Record<string, unknown>
  const token = typeof b.token === 'string' ? b.token : undefined

  if (!token) {
    const res = NextResponse.json({ error: 'missing_token' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ConsentDenyAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    const cr = await prisma.consentRequest.findUnique({
      where: { token },
      select: { id: true, status: true, expiresAt: true, studentId: true },
    })

    if (!cr) {
      const res = NextResponse.json({ error: 'not_found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'ConsentDenyAPI', methodName: 'POST' }, start)
      return res
    }

    if (cr.status !== 'PENDING') {
      const res = NextResponse.json({ error: 'already_processed', status: cr.status }, { status: 409 })
      logger.logAPI(req, res, { className: 'ConsentDenyAPI', methodName: 'POST' }, start)
      return res
    }

    await prisma.consentRequest.update({
      where: { id: cr.id },
      data: { status: 'DENIED' },
    })

    logger.info('consent.deny.success', { consentRequestId: cr.id, studentId: cr.studentId })

    const res = NextResponse.json({ ok: true })
    logger.logAPI(req, res, { className: 'ConsentDenyAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('consent.deny.error', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ConsentDenyAPI', methodName: 'POST' }, start)
    return res
  }
}
