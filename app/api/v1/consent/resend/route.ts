/**
 * FILE OBJECTIVE:
 * - Resend a consent request. Enforces a cooldown and adds a new message log entry.
 *   The consent token is kept STABLE so the client can continue polling without updating its URL.
 *   Supports optional channel/contact switch (validated per channel).
 *   Blocks resend for terminal statuses (APPROVED/DENIED).
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
 * - 2026-04-24T12:00:00Z | copilot | keep token stable; block terminal statuses; validate contact; fetch student details for WA
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendConsentRequest } from '@/lib/whatsapp/cloud.service'
import { sendMailSafe } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const COOLDOWN_MS = 15 * 60 * 1000 // 15 minutes

/** Basic e-mail format check. */
function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/** Basic phone check: 8–15 digits with optional leading '+'. */
function isValidPhone(s: string): boolean {
  const digits = s.replace(/[\s\-()]/g, '')
  return /^\+?[0-9]{8,15}$/.test(digits)
}

export async function POST(req: Request) {
  const start = Date.now()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const token = typeof b.consent_token === 'string' ? b.consent_token : undefined
  const newContact = typeof b.new_contact === 'string' ? b.new_contact.trim() : undefined
  const newChannel = b.new_channel === 'email' ? 'email' : b.new_channel === 'whatsapp' ? 'whatsapp' : undefined

  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })

  try {
    const cr = await prisma.consentRequest.findUnique({
      where: { token },
      include: { messageLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    if (!cr) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Block resend for terminal statuses — resending would be misleading and wasteful.
    if (cr.status === 'APPROVED' || cr.status === 'DENIED') {
      return NextResponse.json({ error: 'terminal_status' }, { status: 409 })
    }

    // Cooldown: prevent message spam.
    const lastLog = cr.messageLogs?.[0]
    if (lastLog && Date.now() - lastLog.createdAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: 'cooldown' }, { status: 429 })
    }

    // Resolve effective contact and channel (new_contact overrides stored value).
    const effectiveChannel = newChannel ?? (cr.parentPhone ? 'whatsapp' : 'email')
    const effectiveContact = newContact ?? (effectiveChannel === 'whatsapp' ? cr.parentPhone : cr.parentEmail)

    if (!effectiveContact) {
      return NextResponse.json({ error: 'no_contact' }, { status: 400 })
    }

    // Validate contact format per channel.
    if (effectiveChannel === 'whatsapp' && !isValidPhone(effectiveContact)) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 })
    }
    if (effectiveChannel === 'email' && !isValidEmail(effectiveContact)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }

    // Fetch student details so the WA template is populated correctly.
    const student = await prisma.user.findUnique({
      where: { id: cr.studentId },
      select: { name: true, grade: true, board: true },
    })

    // If the contact/channel changed, patch the ConsentRequest in-place (no new token).
    if (newContact || newChannel) {
      await prisma.consentRequest.update({
        where: { id: cr.id },
        data: {
          parentPhone: effectiveChannel === 'whatsapp' ? effectiveContact : null,
          parentEmail: effectiveChannel === 'email' ? effectiveContact : null,
          channel: effectiveChannel === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
        },
      })
    }

    // Send message (best-effort) and log it.
    try {
      if (effectiveChannel === 'whatsapp') {
        await sendConsentRequest(
          effectiveContact,
          student?.name ?? '',
          student?.grade ?? '',
          student?.board ?? '',
          token,
        )
        await prisma.consentMessageLog.create({
          data: { consentRequestId: cr.id, channel: 'WHATSAPP', status: 'SENT' },
        })
      } else {
        const consentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/consent/${token}`
        await sendMailSafe({
          to: effectiveContact,
          subject: `Please approve ${student?.name ?? 'your child'}'s Spinzy account`,
          html: `Please approve: ${consentUrl}`,
        })
        await prisma.consentMessageLog.create({
          data: { consentRequestId: cr.id, channel: 'EMAIL', status: 'SENT' },
        })
      }
    } catch (e) {
      logger.warn('consent.resend: send failed', { error: String(e), consentRequestId: cr.id })
    }

    // Return the SAME token so the client continues polling without any URL update.
    const res = NextResponse.json({ ok: true, consent_token: token })
    logger.logAPI(req, res, { className: 'ConsentResendAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('consent.resend failed', { error: String(err) })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
