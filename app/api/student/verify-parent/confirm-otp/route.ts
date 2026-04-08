import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { getRedis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5
const LOCKOUT_TTL = 3600

function otpKey(studentId: string): string {
  return `otp:parent:${studentId}`
}
function attemptsKey(studentId: string): string {
  return `otp:parent:attempts:${studentId}`
}
function lockKey(studentId: string): string {
  return `otp:parent:locked:${studentId}`
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
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
    if (!/^\d{6}$/.test(otp)) {
      const res = NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 })
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const redis = getRedis()
    const locked = await redis.get(lockKey(userId))
    if (locked !== null) {
      const res = NextResponse.json(
        { verified: false, error: 'Too many attempts. Try again in an hour.' },
        { status: 423 },
      )
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const stored = await redis.get(otpKey(userId))
    if (!stored) {
      const res = NextResponse.json(
        { verified: false, error: 'OTP expired or not sent' },
        { status: 400 },
      )
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    if (constantTimeCompare(otp, stored)) {
      await redis.del(otpKey(userId))
      await redis.del(attemptsKey(userId))
      await prisma.user.update({
        where: { id: userId },
        data: { parentVerifiedAt: new Date() },
      })
      const res = NextResponse.json({ verified: true })
      logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
      return res
    }

    const attemptKey = attemptsKey(userId)
    const attempts = await redis.incr(attemptKey)
    if (attempts === 1) await redis.expire(attemptKey, LOCKOUT_TTL)
    if (attempts >= MAX_ATTEMPTS) {
      await redis.setex(lockKey(userId), LOCKOUT_TTL, '1')
    }

    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - attempts)
    const res = NextResponse.json({
      verified: false,
      attemptsRemaining: attempts >= MAX_ATTEMPTS ? 0 : attemptsRemaining,
    })
    logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('VerifyParentConfirmOtpAPI failed', { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    )
    logger.logAPI(req, res, { className: 'VerifyParentConfirmOtpAPI', methodName: 'POST' }, start)
    return res
  }
}
