/**
 * FILE OBJECTIVE:
 * - Confirm channel-specific parent OTP and persist verification state when either channel is verified.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/verify-parent/confirm-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | send welcome notifications upon successful verification
 * - 2026-05-11T00:00:00Z | copilot | support separate email/whatsapp OTP verification and return channel verification status
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { parentWelcomeHtml } from '@/lib/email/templates'
import {
  channelOtpKeyByType,
  getParentChannelVerificationStatus,
  resolveParentChannels,
} from '@/lib/parent/contactLinking'
import { formatErrorForResponse } from '@/lib/errorResponse'

export const dynamic = 'force-dynamic'

function hashOtp(otp: string): string {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret'
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex')
}

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const body = await req.json().catch(() => ({}))
    const otp = typeof body.otp === 'string' ? body.otp.replace(/\s/g, '') : ''
    const channel = body.channel === 'email' || body.channel === 'whatsapp' ? body.channel : null

    if (!/^\d{6}$/.test(otp)) {
      const res = NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 })
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { parentEmail: true, parentPhone: true, whatsappPhone: true, name: true },
    })

    if (!student) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const channels = resolveParentChannels(student.parentEmail, student.whatsappPhone, student.parentPhone)

    const otpKeys = channel
      ? [channelOtpKeyByType(channel, channels.normalizedEmail, channels.resolvedWhatsappDigits)]
      : [
          channelOtpKeyByType('email', channels.normalizedEmail, channels.resolvedWhatsappDigits),
          channelOtpKeyByType('whatsapp', channels.normalizedEmail, channels.resolvedWhatsappDigits),
          channels.resolvedWhatsappDigits,
        ]

    const otpRecord = await prisma.phoneOtp.findFirst({
      where: {
        userId,
        consumed: false,
        expiresAt: { gte: new Date() },
        codeHash: hashOtp(otp),
        phone: { in: otpKeys.filter(Boolean) },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      const res = NextResponse.json({ verified: false, error: 'Invalid or expired code' }, { status: 400 })
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    await prisma.$transaction([
      prisma.phoneOtp.update({ where: { id: otpRecord.id }, data: { consumed: true } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          parentVerifiedAt: new Date(),
          parentPhoneVerifiedAt: new Date(),
          accountStatus: 'active',
        },
      }),
    ])

    try {
      const studentName = student.name ?? 'your child'
      const parentEmail = student.parentEmail?.trim() || null
      const parentPhone = student.whatsappPhone?.trim() || student.parentPhone?.trim() || null

      if (parentEmail) {
        await sendMailSafe({
          to: parentEmail,
          subject: `Parent access confirmed for ${studentName}`,
          html: parentWelcomeHtml(null, studentName),
        })
      }

      if (parentPhone) {
        await sendSms(
          parentPhone,
          `Your Spinzy parent account for ${studentName} is verified. You can view progress and weekly reports. See your email for privacy details.`,
        )
      }
    } catch (err) {
      logger.error('[verify-parent] welcome notification suppressed', { error: String(err) })
    }

    const verification = await getParentChannelVerificationStatus({
      prisma,
      studentId: userId,
      parentEmail: student.parentEmail,
      whatsappPhone: student.whatsappPhone,
      parentPhone: student.parentPhone,
    })

    const res = NextResponse.json({ verified: true, verification })
    logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('VerifyParentConfirmOtpAPI failed', { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 })
    logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
    return res
  }
}
