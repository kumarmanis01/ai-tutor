import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { getRedis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMail } from '@/lib/mailer'
import { parentOtpHtml } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const OTP_TTL = 600
const SEND_RATE_WINDOW = 600
const MAX_SENDS = 3

function otpKey(studentId: string): string {
  return `otp:parent:${studentId}`
}
function sendCountKey(studentId: string): string {
  return `otp:parent:sendcount:${studentId}`
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***'
  const [local, domain] = email.split('@')
  const masked = local.length <= 2 ? '***' : local[0] + '***' + local[local.length - 1]
  return `${masked}@${domain}`
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
      select: { parentEmail: true, name: true },
    })
    const parentEmail = user?.parentEmail?.trim()
    if (!parentEmail) {
      const res = NextResponse.json({ error: 'Parent email not set' }, { status: 400 })
      logger.logAPI(req, res, { className: 'VerifyParentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const redis = getRedis()
    const countKey = sendCountKey(userId)
    const current = await redis.incr(countKey)
    if (current === 1) await redis.expire(countKey, SEND_RATE_WINDOW)
    if (current > MAX_SENDS) {
      const res = NextResponse.json(
        { error: 'Too many OTP requests. Try again later.' },
        { status: 429 },
      )
      logger.logAPI(req, res, { className: 'VerifyParentSendOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const key = otpKey(userId)
    await redis.setex(key, OTP_TTL, otp)

    if (process.env.NODE_ENV !== 'production') {
      logger.add(`[verify-parent] OTP for ${userId} (dev): ${otp}`, {
        className: 'VerifyParentSendOtpAPI',
        methodName: 'POST',
      })
    }

    // Send OTP to parent email -- throws on failure so the caller knows it wasn't sent
    const studentName = user.name ?? 'your child'
    await sendMail({
      to: parentEmail,
      subject: `Verify ${studentName}'s Spinzy Academy account`,
      html: parentOtpHtml(otp, studentName),
    })

    const res = NextResponse.json({
      sent: true,
      maskedEmail: maskEmail(parentEmail),
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
