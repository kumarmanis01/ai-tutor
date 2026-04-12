/**
 * FILE OBJECTIVE:
 * - API to allow a parent to create a minimal child account and link it to their parent profile.
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
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { FAMILY_MAX_CHILDREN } from '@/app/api/billing/constants'

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
  if (!name) {
    const res = NextResponse.json({ error: 'child name required' }, { status: 400 })
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

    // Create child user and parentStudent link in a transaction
    const child = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, phone, role: 'student' } })
      await tx.parentStudent.create({ data: { parentId, studentId: created.id, status: 'active' } })
      // promote parent role if necessary
      const p = await tx.user.findUnique({ where: { id: parentId }, select: { role: true } })
      if (p?.role === 'user') {
        await tx.user.update({ where: { id: parentId }, data: { role: 'parent' } })
      }
      return created
    })

    // Notify parent
    try {
      const parent = await prisma.user.findUnique({ where: { id: parentId }, select: { email: true, phone: true, name: true } })
      const parentName = parent?.name ?? 'Parent'
      if (parent?.email) {
        await sendMailSafe({
          to: parent.email,
          subject: `Child account created: ${child.name}`,
          html: `<p>Hi ${parentName},</p><p>We've created a child account for ${child.name} and linked it to your account.</p>`,
        })
      }
      if (parent?.phone) {
        await sendSms(parent.phone, `Child ${child.name} created and linked to your Spinzy account.`)
      }
    } catch (err) {
      logger.error('[parent:create-child] notification suppressed', { error: String(err) })
    }

    const res = NextResponse.json({ ok: true, child: { id: child.id, name: child.name } }, { status: 201 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('ParentCreateChildAPI failed', { className: 'ParentCreateChildAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }
}
