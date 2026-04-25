/**
 * FILE OBJECTIVE:
 * - P1.3-R: Approve a parent consent request via Google OAuth session or 6-digit OTP.
 *   method='google' : requires an active NextAuth session (parent just completed OAuth).
 *   method='otp'    : verifies OTP stored in PhoneOtp; no session required.
 *   On success: ConsentRequest -> APPROVED, student accountStatus -> active,
 *   ParentStudent link created (google path only).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/approve.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.3-R AC
 */

import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getServerSessionForHandlers } from '@/lib/session'
import { AccountStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const start = Date.now()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    const res = NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
    return res
  }

  const b = body as Record<string, unknown>
  const token = typeof b.token === 'string' ? b.token : undefined
  const method = b.method === 'google' ? 'google' : b.method === 'otp' ? 'otp' : undefined
  const otpCode = typeof b.otp_code === 'string' ? b.otp_code.trim() : undefined

  if (!token) {
    const res = NextResponse.json({ error: 'missing_token' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
    return res
  }
  if (!method) {
    const res = NextResponse.json({ error: 'invalid_method' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
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
      logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
      return res
    }
    if (cr.status !== 'PENDING') {
      const res = NextResponse.json({ error: 'already_processed', status: cr.status }, { status: 409 })
      logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
      return res
    }
    if (cr.expiresAt < new Date()) {
      const res = NextResponse.json({ error: 'expired' }, { status: 410 })
      logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
      return res
    }

    let parentId: string | null = null

    if (method === 'google') {
      // Parent must have an active session (completed Google OAuth on the mini-page)
      const session = await getServerSession(authOptions)
      const sessionParentId = (session?.user as { id?: string } | undefined)?.id
      if (!sessionParentId) {
        const res = NextResponse.json({ error: 'auth_required' }, { status: 401 })
        logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
        return res
      }
      parentId = sessionParentId
    } else {
      // OTP path: verify code against PhoneOtp table
      if (!otpCode) {
        const res = NextResponse.json({ error: 'missing_otp_code' }, { status: 400 })
        logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
        return res
      }

      // The contact identifier is phone (WhatsApp) or email
      const contactKey = cr.parentPhone ?? cr.parentEmail
      if (!contactKey) {
        const res = NextResponse.json({ error: 'no_parent_contact' }, { status: 400 })
        logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
        return res
      }

      const secret = process.env.OTP_SECRET ?? 'fallback-secret'
      const codeHash = createHash('sha256').update(`${otpCode}${secret}`).digest('hex')

      const otpRecord = await prisma.phoneOtp.findFirst({
        where: {
          phone: contactKey,
          codeHash,
          consumed: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!otpRecord) {
        // Increment attempt counter on any matching non-consumed record to track brute-force
        await prisma.phoneOtp.updateMany({
          where: { phone: contactKey, consumed: false, expiresAt: { gte: new Date() } },
          data: { attempts: { increment: 1 } },
        })
        const res = NextResponse.json({ error: 'invalid_otp' }, { status: 400 })
        logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
        return res
      }

      if (otpRecord.attempts >= 3) {
        const res = NextResponse.json({ error: 'max_attempts_exceeded' }, { status: 429 })
        logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
        return res
      }

      // Consume the OTP
      await prisma.phoneOtp.update({ where: { id: otpRecord.id }, data: { consumed: true } })
    }

    // Approve: update consent request + activate student in a transaction
    await prisma.$transaction([
      prisma.consentRequest.update({
        where: { id: cr.id },
        data: { status: 'APPROVED' },
      }),
      prisma.user.update({
        where: { id: cr.studentId },
        data: { accountStatus: AccountStatus.active },
      }),
    ])

    // If approved via Google, create ParentStudent link and ensure parent role
    if (parentId) {
      await prisma.parentStudent
        .upsert({
          where: { parentId_studentId: { parentId, studentId: cr.studentId } },
          create: { parentId, studentId: cr.studentId, status: 'active' },
          update: {},
        })
        .catch((err: unknown) =>
          logger.warn('ConsentApproveAPI: parentStudent upsert failed', { error: String(err) }),
        )
      // Elevate role to parent if still 'user'
      await prisma.user
        .updateMany({
          where: { id: parentId, role: 'user' },
          data: { role: 'parent' },
        })
        .catch((err: unknown) =>
          logger.warn('ConsentApproveAPI: role elevation failed', { error: String(err) }),
        )
    }

    logger.info('consent.approve.success', {
      consentRequestId: cr.id,
      method,
      parentId: parentId ?? 'otp-only',
    })

    const res = NextResponse.json({
      ok: true,
      studentId: cr.studentId,
      parentId: parentId ?? null,
    })
    logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('consent.approve.error', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ConsentApproveAPI', methodName: 'POST' }, start)
    return res
  }
}
