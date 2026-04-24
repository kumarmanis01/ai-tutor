/**
 * FILE OBJECTIVE:
 * - P1.2-P: Parent grants consent for a child they have already linked via
 *   the parent onboarding flow (AddChildForm). Requires an authenticated parent
 *   session. Activates the child account by setting accountStatus -> active.
 *   Records an AuditLog event for DPDP compliance traceability.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent/consent/grant.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.2-P AC
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { AccountStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const start = Date.now()

  // Auth gate: parent session required
  const session = await getServerSession(authOptions)
  const parentId = (session?.user as { id?: string } | undefined)?.id
  if (!parentId) {
    const res = NextResponse.json({ error: 'auth_required' }, { status: 401 })
    logger.logAPI(req, res, { className: 'ParentConsentGrantAPI', methodName: 'POST' }, start)
    return res
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    const res = NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentConsentGrantAPI', methodName: 'POST' }, start)
    return res
  }

  const b = body as Record<string, unknown>
  const childId = typeof b.child_id === 'string' ? b.child_id : undefined

  if (!childId) {
    const res = NextResponse.json({ error: 'missing_child_id' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentConsentGrantAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    // Verify the parent owns this child (ParentStudent link must exist)
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId: childId } },
      select: { status: true },
    })
    if (!link) {
      const res = NextResponse.json({ error: 'child_not_linked' }, { status: 403 })
      logger.logAPI(req, res, { className: 'ParentConsentGrantAPI', methodName: 'POST' }, start)
      return res
    }

    // Activate the child's account
    await prisma.user.update({
      where: { id: childId },
      data: { accountStatus: AccountStatus.active },
    })

    // Emit an audit log for DPDP compliance
    await prisma.auditLog
      .create({
        data: {
          adminId: parentId,
          targetEntity: 'User',
          targetId: childId,
          details: { action: 'parent.consent.grant', grantedAt: new Date().toISOString() },
        },
      })
      .catch((err: unknown) =>
        logger.warn('ParentConsentGrantAPI: auditLog failed', { error: String(err) }),
      )

    logger.info('parent.consent.grant.success', { parentId, childId })

    const res = NextResponse.json({ ok: true, childId })
    logger.logAPI(req, res, { className: 'ParentConsentGrantAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('parent.consent.grant.error', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ParentConsentGrantAPI', methodName: 'POST' }, start)
    return res
  }
}
