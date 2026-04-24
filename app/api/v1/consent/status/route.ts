/**
 * FILE OBJECTIVE:
 * - Return the status of a ConsentRequest given a consent token.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/status.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

function maskContact(phone?: string | null, email?: string | null) {
  if (phone) return phone.replace(/(\d)(?=\d{4})/g, '*')
  if (email) {
    const [local, domain] = email.split('@')
    const visible = local.slice(0, 1)
    return `${visible}***@${domain}`
  }
  return null
}

export async function GET(req: Request) {
  const start = Date.now()
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('consent_token')
    if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })

    const cr = await prisma.consentRequest.findUnique({ where: { token }, include: { messageLogs: true } })
    if (!cr) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const reminderCount = cr.messageLogs.length
    const res = NextResponse.json({ ok: true, status: cr.status, expiresAt: cr.expiresAt, sentTo: maskContact(cr.parentPhone, cr.parentEmail), channel: cr.channel, reminderCount })
    logger.logAPI(req, res, { className: 'ConsentStatusAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    logger.error('consent.status failed', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ConsentStatusAPI', methodName: 'GET' }, start)
    return res
  }
}
