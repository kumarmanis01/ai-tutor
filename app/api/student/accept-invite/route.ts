/**
 * FILE OBJECTIVE:
 * - GET /api/student/accept-invite?token=xxx
 * - No auth required. Validates an invite token and returns pre-populated student data
 *   so the accept-invite page can render a pre-filled activation form.
 *
 * EDIT LOG:
 * - 2026-05-29 | claude | created for parent-invite child activation flow
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CLASS_NAME = 'AcceptInviteAPI'

export async function GET(req: Request) {
  const start = Date.now()
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') ?? ''

  if (!token) {
    const res = NextResponse.json({ error: 'token required' }, { status: 400 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
    return res
  }

  try {
    const user = await prisma.user.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        grade: true,
        board: true,
        language: true,
        dateOfBirth: true,
        inviteTokenExpiry: true,
        inviteAcceptedAt: true,
      },
    })

    if (!user) {
      const res = NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
      return res
    }

    if (user.inviteAcceptedAt) {
      const res = NextResponse.json({ error: 'Invite already used' }, { status: 409 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
      return res
    }

    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      const res = NextResponse.json({ error: 'Invite expired' }, { status: 410 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
      return res
    }

    const res = NextResponse.json({
      studentId: user.id,
      name: user.name ?? '',
      email: user.email ?? null,
      grade: user.grade ?? null,
      board: user.board ?? null,
      medium: user.language ?? null,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null,
      parentLinked: true,
      token,
    })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
    return res
  } catch (err) {
    logger.error('AcceptInviteAPI GET failed', { className: CLASS_NAME, error: String(err) })
    const res = NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
    return res
  }
}
