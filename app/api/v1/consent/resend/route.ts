/**
 * FILE OBJECTIVE:
 * - Resend a consent request. Enforces a cooldown, expires the previous request, and creates/sends a new one.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/resend.spec.ts
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
import { sendConsentRequest } from '@/lib/whatsapp/cloud.service'
import { sendMailSafe } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const COOLDOWN_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(req: Request) {
  const start = Date.now()
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const token = body.consent_token
  const newContact = typeof body.new_contact === 'string' ? body.new_contact.trim() : undefined
  const newChannel = body.new_channel === 'email' ? 'email' : body.new_channel === 'whatsapp' ? 'whatsapp' : undefined

  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })

  try {
    const cr = await prisma.consentRequest.findUnique({ where: { token }, include: { messageLogs: { orderBy: { createdAt: 'desc' }, take: 1 } } })
    if (!cr) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const lastLog = cr.messageLogs?.[0]
    if (lastLog && Date.now() - lastLog.createdAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: 'cooldown' }, { status: 429 })
    }

    // expire old request and create a new one
    await prisma.consentRequest.update({ where: { id: cr.id }, data: { status: 'EXPIRED' } })

    const contact = newContact ?? (cr.parentPhone ?? cr.parentEmail)
    const channel = newChannel ?? (cr.parentPhone ? 'whatsapp' : 'email')
    const newToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const newReq = await prisma.consentRequest.create({ data: {
      studentId: cr.studentId,
      parentPhone: channel === 'whatsapp' ? contact : null,
      parentEmail: channel === 'email' ? contact : null,
      channel: channel === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
      token: newToken,
      expiresAt,
    } })

    try {
      if (channel === 'whatsapp') {
        await sendConsentRequest(contact, '', '', '', newToken)
        await prisma.consentMessageLog.create({ data: { consentRequestId: newReq.id, channel: 'WHATSAPP', status: 'SENT' } })
      } else {
        const consentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/consent/${newToken}`
        await sendMailSafe({ to: contact, subject: `Please approve`, html: `Please approve: ${consentUrl}` })
        await prisma.consentMessageLog.create({ data: { consentRequestId: newReq.id, channel: 'EMAIL', status: 'SENT' } })
      }
    } catch (e) {
      logger.warn('consent.resend: send failed', { error: String(e), consentRequestId: newReq.id })
    }

    const res = NextResponse.json({ ok: true, consent_token: newToken })
    logger.logAPI(req, res, { className: 'ConsentResendAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('consent.resend failed', { error: String(err) })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
