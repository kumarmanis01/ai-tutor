/**
 * FILE OBJECTIVE:
 * - POST /api/student/activate-invite
 * - No auth required. Activates the shell User created by the parent by:
 *   - Setting accountStatus = 'active'
 *   - Clearing the invite token (single-use)
 *   - Setting parentVerifiedAt and emailVerified (parent already verified these)
 *   - Hashing and storing the student's chosen password
 * - Does NOT create a new User -- activates the existing shell record.
 *
 * EDIT LOG:
 * - 2026-05-29 | claude | created for parent-invite child activation flow
 */

import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { invalidateUserSessionCache } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CLASS_NAME = 'ActivateInviteAPI'
const MIN_PASSWORD_LENGTH = 8

export async function POST(req: Request) {
  const start = Date.now()

  let body: unknown
  try { body = await req.json() } catch {
    const res = NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }

  const token = typeof (body as any)?.token === 'string' ? (body as any).token.trim() : ''
  const password = typeof (body as any)?.password === 'string' ? (body as any).password : ''

  if (!token) {
    const res = NextResponse.json({ error: 'token required' }, { status: 400 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    const res = NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    )
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }

  try {
    const user = await prisma.user.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        email: true,
        inviteTokenExpiry: true,
        inviteAcceptedAt: true,
      },
    })

    if (!user) {
      const res = NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
      return res
    }

    if (user.inviteAcceptedAt) {
      const res = NextResponse.json({ error: 'Invite already used' }, { status: 409 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
      return res
    }

    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      const res = NextResponse.json({ error: 'Invite expired' }, { status: 410 })
      logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
      return res
    }

    const passwordHash = await hash(password, 10)
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          accountStatus: 'active',
          role: 'student',
          inviteAcceptedAt: now,
          inviteToken: null,
          inviteTokenExpiry: null,
          passwordHash,
          parentVerifiedAt: now,
          emailVerified: now,
        },
      })
    })

    if (user.email) {
      await invalidateUserSessionCache(user.email)
    }

    logger.info('Invite activated', { className: CLASS_NAME, userId: user.id })
    const res = NextResponse.json({ success: true, redirectTo: '/student/dashboard' })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('ActivateInviteAPI failed', { className: CLASS_NAME, error: String(err) })
    const res = NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'POST' }, start)
    return res
  }
}
