/**
 * FILE OBJECTIVE:
 * - Send separate parent verification OTP codes for email and WhatsApp channels and report per-channel verification status.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/verify-parent/send-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | switch to separate channel OTP delivery and expose channel verification status
 * - 2026-05-20T00:00:00Z | copilot | refactor: use centralized sendEmailUnifiedSafe (lib/mail), remove direct sendMailSafe per infra policy
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendEmailUnifiedSafe } from '@/lib/mail'
import { sendWhatsAppSafe } from '@/lib/whatsapp/sender'
import { parentOtpHtml } from '@/lib/email/templates'
import crypto from 'crypto'
import {
  channelOtpKeyByType,
  getParentChannelVerificationStatus,
  resolveParentChannels,
} from '@/lib/parent/contactLinking'
import { MAIL_SUBJECTS } from '@/lib/constants/mail'

export const dynamic = 'force-dynamic'

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS ?? 300)
const MAX_SENDS_IN_WINDOW = 5
const SEND_WINDOW_MS = 15 * 60 * 1000

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashOtp(otp: string): string {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret'
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex')
}

function bestEffortIp(req: Request): string {
  return req.headers.get('x-forwarded-for') || 'unknown'
}

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'VerifyParentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { parentEmail: true, parentPhone: true, whatsappPhone: true, name: true },
    })

    const channels = resolveParentChannels(user?.parentEmail, user?.whatsappPhone, user?.parentPhone)
    if (!channels.hasEmail && !channels.hasWhatsapp) {
      const res = NextResponse.json({ error: 'Add a parent email or WhatsApp number before sending a verification code.' }, { status: 400 })
      logger.logAPI(req, res, { className: 'VerifyParentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const recentCount = await prisma.phoneOtp.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - SEND_WINDOW_MS) },
      },
    })
    if (recentCount >= MAX_SENDS_IN_WINDOW) {
      const res = NextResponse.json(
        { error: 'Too many OTP requests. Try again later.' },
        { status: 429 },
      )
      logger.logAPI(req, res, { className: 'VerifyParentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000)
    const ip = bestEffortIp(req)
    const studentName = user.name ?? 'your child'

    const sentTo: { email?: string; whatsapp?: string } = {}

    if (channels.hasEmail) {
      const emailOtp = generateOtp()
      await prisma.phoneOtp.create({
        data: {
          userId,
          phone: channelOtpKeyByType('email', channels.normalizedEmail, channels.resolvedWhatsappDigits),
          codeHash: hashOtp(emailOtp),
          expiresAt,
          ip,
        },
      })

      await sendEmailUnifiedSafe({
        mode: 'raw',
        delivery: 'best_effort',
        to: channels.normalizedEmail,
        subject: MAIL_SUBJECTS.PARENT_OTP,
        html: parentOtpHtml(emailOtp, studentName),
        reason: 'parent_otp_verification',
        featureFlagDomain: 'auth',
      })
      sentTo.email = channels.normalizedEmail
    }

    if (channels.hasWhatsapp) {
      const whatsappOtp = generateOtp()
      await prisma.phoneOtp.create({
        data: {
          userId,
          phone: channelOtpKeyByType('whatsapp', channels.normalizedEmail, channels.resolvedWhatsappDigits),
          codeHash: hashOtp(whatsappOtp),
          expiresAt,
          ip,
        },
      })

      const whatsappMessage = `Your Spinzy Academy parent verification code for ${studentName} is: ${whatsappOtp}. Valid for ${Math.round(
        OTP_EXPIRY_SECONDS / 60,
      )} minutes.`
      await sendWhatsAppSafe(channels.resolvedWhatsappDigits, whatsappMessage)
      sentTo.whatsapp = channels.resolvedWhatsappDigits
    }

    const verification = await getParentChannelVerificationStatus({
      prisma,
      studentId: userId,
      parentEmail: user?.parentEmail,
      whatsappPhone: user?.whatsappPhone,
      parentPhone: user?.parentPhone,
    })

    const res = NextResponse.json({
      sent: true,
      sentTo,
      expiresInSeconds: OTP_EXPIRY_SECONDS,
      verification,
    })
    logger.logAPI(req, res, { className: 'VerifyParentSendOtpAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('VerifyParentSendOtpAPI failed', { className: 'VerifyParentSendOtpAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    )
    logger.logAPI(req, res, { className: 'VerifyParentSendOtpAPI', methodName: 'POST' }, start)
    return res
  }
}
