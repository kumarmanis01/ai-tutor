/**
 * FILE OBJECTIVE:
 * - P1.3-R: Send a 6-digit OTP to the parent contact (WhatsApp or email) so they
 *   can approve their child's consent request without Google OAuth.
 *   Rate-limited: 15-minute cooldown enforced via last PhoneOtp record.
 *   OTP stored (hashed) in PhoneOtp; valid for 10 minutes; max 3 attempts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/send-otp.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.3-R AC
 */

import { createHash, randomInt } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendOTP as sendWhatsAppOTP } from '@/lib/whatsapp/cloud.service'
import { sendMailSafe } from '@/lib/mailer'
import { otpEmailHtml } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const OTP_TTL_MS = 10 * 60 * 1000        // 10 minutes
const COOLDOWN_MS = 15 * 60 * 1000       // 15 minutes between resends

export async function POST(req: Request) {
  const start = Date.now()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    const res = NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
    return res
  }

  const b = body as Record<string, unknown>
  const token = typeof b.token === 'string' ? b.token : undefined

  if (!token) {
    const res = NextResponse.json({ error: 'missing_token' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    const cr = await prisma.consentRequest.findUnique({
      where: { token },
      select: {
        id: true,
        studentId: true,
        status: true,
        expiresAt: true,
        parentPhone: true,
        parentEmail: true,
        channel: true,
      },
    })

    if (!cr) {
      const res = NextResponse.json({ error: 'not_found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }
    if (cr.status !== 'PENDING') {
      const res = NextResponse.json({ error: 'already_processed', status: cr.status }, { status: 409 })
      logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }
    if (cr.expiresAt < new Date()) {
      const res = NextResponse.json({ error: 'request_expired' }, { status: 410 })
      logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    // The "phone" field in PhoneOtp doubles as a contact key (phone or email)
    const contactKey = cr.parentPhone ?? cr.parentEmail
    if (!contactKey) {
      const res = NextResponse.json({ error: 'no_parent_contact' }, { status: 400 })
      logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    // Cooldown check — prevent OTP spam
    const recentOtp = await prisma.phoneOtp.findFirst({
      where: { phone: contactKey, consumed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (recentOtp && Date.now() - recentOtp.createdAt.getTime() < COOLDOWN_MS) {
      const res = NextResponse.json({ error: 'cooldown' }, { status: 429 })
      logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    // Generate OTP using cryptographically-secure random integer
    const otp = String(randomInt(100000, 999999))
    const secret = process.env.OTP_SECRET ?? 'fallback-secret'
    const codeHash = createHash('sha256').update(`${otp}${secret}`).digest('hex')
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    await prisma.phoneOtp.create({
      data: { phone: contactKey, codeHash, expiresAt },
    })

    // Send OTP via the appropriate channel
    const channel = cr.channel
    if (channel === 'WHATSAPP' && cr.parentPhone) {
      await sendWhatsAppOTP(cr.parentPhone, otp)
    } else if (cr.parentEmail) {
      await sendMailSafe({
        to: cr.parentEmail,
        subject: `${otp} is your Spinzy verification code`,
        html: otpEmailHtml(otp, 10),
      })
    }

    logger.info('consent.send-otp.success', { consentRequestId: cr.id, channel })

    const res = NextResponse.json({ ok: true, expiresInSeconds: Math.floor(OTP_TTL_MS / 1000) })
    logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('consent.send-otp.error', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ConsentSendOtpAPI', methodName: 'POST' }, start)
    return res
  }
}
