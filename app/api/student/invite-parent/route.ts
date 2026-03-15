import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const INVITE_TTL_SECONDS = 48 * 60 * 60 // 48 hours

/**
 * POST /api/student/invite-parent
 *
 * Auth-guarded (student). Generates a short-lived invite token stored in Redis
 * (TTL 48h) and returns an invite URL the student can share with their parent.
 *
 * Returns: { inviteUrl: string }
 */
export async function POST(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'InviteParentAPI', methodName: 'POST' }, start)
    return res
  }

  const redis = getRedis()
  if (!redis) {
    const res = NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: 'InviteParentAPI', methodName: 'POST' }, start)
    return res
  }

  // Generate a URL-safe token (32 hex chars = 128 bits)
  const token = randomBytes(16).toString('hex')
  const key = `parent_invite:${token}`

  // Store studentId in Redis — single-use token (deleted on claim)
  await redis.set(key, userId, 'EX', INVITE_TTL_SECONDS)

  const appUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const inviteUrl = `${appUrl}/parent/accept-invite?token=${token}`

  const res = NextResponse.json({ inviteUrl }, { status: 200 })
  logger.logAPI(req, res, { className: 'InviteParentAPI', methodName: 'POST' }, start)
  return res
}
