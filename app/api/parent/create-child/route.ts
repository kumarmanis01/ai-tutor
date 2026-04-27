/**
 * FILE OBJECTIVE:
 * - API to allow a parent to create a minimal child account and link it to their parent profile.
 * - Accepts: name, email, phone, dateOfBirth, grade, board, medium (language) (F-PAR-002 AC-01).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-create-child.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created
 * - 2026-04-12T12:00:00Z | copilot | use FAMILY_MAX_CHILDREN constant from billing constants
 * - 2026-04-14T00:00:00Z | claude | added dateOfBirth, grade, board, medium fields (F-PAR-002 AC-01)
 * - 2026-04-14T12:00:00Z | staff-engineer | fix: create child with role 'user', default language, remove unused const
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { FAMILY_MAX_CHILDREN } from '@/app/api/billing/constants'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'



export async function POST(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const parentId = (session?.user as { id?: string })?.id
  if (!parentId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  const body = await req.json().catch(() => ({})) as any
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim() : undefined
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : undefined

  // F-PAR-002 AC-01 fields
  const grade = typeof body.grade === 'string' ? body.grade.trim() : undefined
  const board = typeof body.board === 'string' ? body.board.trim() : undefined
  // medium maps to language field on User
  const medium = typeof body.medium === 'string' ? body.medium.trim() : undefined
  const dateOfBirth = typeof body.dateOfBirth === 'string' && body.dateOfBirth ? new Date(body.dateOfBirth) : undefined

  if (!name) {
    const res = NextResponse.json({ error: 'child name required' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  if (dateOfBirth && isNaN(dateOfBirth.getTime())) {
    const res = NextResponse.json({ error: 'invalid dateOfBirth' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    // Enforce server-side cap: max FAMILY_MAX_CHILDREN active child links per parent
    const activeCount = await prisma.parentStudent.count({ where: { parentId, status: 'active' } })
    if (activeCount >= FAMILY_MAX_CHILDREN) {
      const res = NextResponse.json({ error: `Parent already has maximum linked children (${FAMILY_MAX_CHILDREN})` }, { status: 409 })
      logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
      return res
    }

    // Fetch parent details to derive defaults (language) and for notifications
    const parentUser = await prisma.user.findUnique({ where: { id: parentId }, select: { language: true, name: true, email: true, phone: true } })
    const defaultLanguage = (parentUser?.language as any) ?? 'en'

    // Create child user and parentStudent link in a transaction
    const child = await prisma.$transaction(async (tx) => {
      const normalizedMedium = typeof medium === 'string' ? medium.toLowerCase() : ''
      const resolvedLanguage = normalizedMedium === 'hi' || normalizedMedium === 'hindi' ? 'hi' : normalizedMedium === 'en' || normalizedMedium === 'english' ? 'en' : defaultLanguage

      const userData: Prisma.UserCreateInput = {
        name,
        email,
        phone,
        role: 'user',
        language: resolvedLanguage as any,
      }
      if (grade) (userData as any).grade = grade
      if (board) (userData as any).board = board
      if (dateOfBirth) (userData as any).dateOfBirth = dateOfBirth

      const created = await tx.user.create({ data: userData as any })
      await tx.parentStudent.create({ data: { parentId, studentId: created.id, status: 'active' } })
      // promote parent role if necessary
      const p = await tx.user.findUnique({ where: { id: parentId }, select: { role: true } })
      if (p?.role === 'user') {
        await tx.user.update({ where: { id: parentId }, data: { role: 'parent' } })
      }
      return created
    })

    // Notify parent with enriched welcome content (F-PAR-001 AC-07)
    try {
      const parent = parentUser ?? await prisma.user.findUnique({ where: { id: parentId }, select: { email: true, phone: true, name: true } })
      const parentName = parent?.name ?? 'Parent'
      const childGrade = grade ? `Class ${grade}` : ''
      if (parent?.email) {
        await sendMailSafe({
          to: parent.email,
          subject: `${child.name}'s learning account is ready on Spinzy`,
          html: `<p>Hi ${parentName},</p>
<p>We've created a learning account for <strong>${child.name}</strong>${childGrade ? ` (${childGrade})` : ''} and linked it to your Spinzy account.</p>
<h3>What you can see as a parent:</h3>
<ul>
  <li>Weekly study activity and sessions completed</li>
  <li>Subject mastery progress and chapter-level breakdown</li>
  <li>Upcoming exam readiness and predicted mark range</li>
  <li>Streak and milestone achievements</li>
</ul>
<h3>What your child can do:</h3>
<ul>
  <li>Practice with Vidya, their AI tutor, in guided sessions</li>
  <li>Take mock tests and revision exercises</li>
  <li>Build a personalised learning plan for board exams</li>
</ul>
<p><strong>Privacy:</strong> Your child's AI tutoring conversations are private to them. You see a summary, not the transcript.</p>
<p>You can view our full privacy policy at <a href="/privacy">spinzyacademy.com/privacy</a>. It's written in plain language and available in English and Hindi.</p>
<p>Happy learning!<br/>Team Spinzy</p>`,
        })
      }
      if (parent?.phone) {
        await sendSms(parent.phone, `Hi ${parentName}! ${child.name}'s Spinzy account is ready. Log in to track their progress. - Team Spinzy`)
      }
    } catch (err) {
      logger.error('[parent:create-child] notification suppressed', { error: String(err) })
    }

    const res = NextResponse.json({
      ok: true,
      child: {
        id: child.id,
        name: child.name,
        grade: (child as any).grade ?? null,
        board: (child as any).board ?? null,
        medium: (child as any).language ?? null,
        dateOfBirth: (child as any).dateOfBirth ? (child as any).dateOfBirth.toISOString() : null,
      },
    }, { status: 201 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('ParentCreateChildAPI failed', { className: 'ParentCreateChildAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }
}
