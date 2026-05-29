/**
 * FILE OBJECTIVE:
 * - Resend a login invitation email to a parent-created child account.
 * - Rate-limited to 1 send per 10 minutes per student (Redis TTL key).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-send-child-invite.spec.ts
 *
 * EDIT LOG:
 * - 2026-05-29 | claude | created for parent-initiated child onboarding flow
 */

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { getRedis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendEmailUnifiedSafe } from '@/lib/mail'

export const dynamic = 'force-dynamic'

const CLASS_NAME = 'SendChildInviteAPI'
const RATE_LIMIT_TTL_SECONDS = 600 // 10 minutes

function childInviteHtml(parentName: string, childName: string, loginUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#534AB7">Welcome to Spinzy Academy!</h2>
      <p>Hi ${childName},</p>
      <p>${parentName} has created a Spinzy Academy account for you.</p>
      <p>Click the button below to set up your account and start learning:</p>
      <a href="${loginUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#534AB7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        Set up your account
      </a>
      <p style="color:#6b7280;font-size:13px">
        If the button doesn't work, copy this link: ${loginUrl}
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        Spinzy Academy &mdash; Personalised AI tutoring
      </p>
    </div>
  `
}

export async function POST(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const parentId = (session?.user as { id?: string })?.id
  if (!parentId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }

  let body: unknown
  try { body = await req.json() } catch {
    const res = NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }

  const studentId = typeof (body as any)?.studentId === 'string' ? (body as any).studentId.trim() : ''
  if (!studentId) {
    const res = NextResponse.json({ error: 'studentId required' }, { status: 400 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }

  try {
    // Verify parent is linked to this student
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    })
    if (!link || link.status !== 'active') {
      const res = NextResponse.json({ error: 'Not linked to this student' }, { status: 403 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
      return res
    }

    // Fetch student and parent in parallel
    const [student, parent] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { name: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: parentId },
        select: { name: true },
      }),
    ])

    if (!student?.email) {
      const res = NextResponse.json({ error: 'Student has no email on file' }, { status: 422 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
      return res
    }

    // Rate limit: 1 invite per RATE_LIMIT_TTL_SECONDS per student
    const redis = getRedis()
    if (redis) {
      const rateLimitKey = `send_child_invite:${studentId}`
      const existing = await redis.get(rateLimitKey)
      if (existing) {
        const res = NextResponse.json(
          { error: 'Invite already sent recently. Please wait 10 minutes before resending.' },
          { status: 429 },
        )
        logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
        return res
      }
      await redis.set(rateLimitKey, '1', 'EX', RATE_LIMIT_TTL_SECONDS)
    }

    // Generate a fresh invite token (invalidates any previous one)
    const inviteToken = crypto.randomBytes(32).toString('hex')
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await prisma.user.update({
      where: { id: studentId },
      data: { inviteToken, inviteTokenExpiry },
    })

    const childName = student.name ?? 'Student'
    const parentName = parent?.name ?? 'Your parent'
    const appUrl = process.env.NEXTAUTH_URL ?? 'https://spinzy.in'
    const inviteUrl = `${appUrl}/auth/invite?token=${inviteToken}`

    await sendEmailUnifiedSafe({
      mode: 'raw',
      delivery: 'best_effort',
      to: student.email,
      subject: `${parentName} created your Spinzy Academy account`,
      html: childInviteHtml(parentName, childName, inviteUrl),
      reason: 'parent_child_invite',
      featureFlagDomain: 'notification',
    })

    logger.info('Child invite sent', { className: CLASS_NAME, parentId, studentId })
    const res = NextResponse.json({ sent: true }, { status: 200 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('SendChildInviteAPI failed', { className: CLASS_NAME, error: String(err) })
    const res = NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }
}
