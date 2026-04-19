/**
 * FILE OBJECTIVE:
 * - Admin-only API to manage the TestPlanAccess whitelist.
 * - GET:    list all whitelisted emails.
 * - POST:   add an email to the whitelist ({ email: string }).
 * - DELETE: remove an email from the whitelist ({ email: string }).
 *
 * Access: requires session.user.role === 'admin'.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/test-plan-access/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | add required header sections for CI documentation enforcement
 * - 2026-04-15T00:00:00Z | staff-engineer | created for Sprint A C1 test plan gating
 * - 2026-04-15T12:00:00Z | copilot | rename unused param to _req to satisfy lint
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const EmailSchema = z.object({ email: z.string().email() })

async function requireAdmin(_req: Request): Promise<{ userId: string } | NextResponse> {
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  const role = (session?.user as { role?: string })?.role
  if (!userId || role !== 'admin') {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Admin access required' }, { status: 403 })
  }
  return { userId }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const rows = await prisma.testPlanAccess.findMany({
    select: { id: true, email: true, grantedAt: true, grantedBy: true },
    orderBy: { grantedAt: 'desc' },
  })
  return NextResponse.json({ entries: rows })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const parsed = EmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ code: 'INVALID_EMAIL', message: 'A valid email is required' }, { status: 400 })
  }

  const { email } = parsed.data

  const entry = await prisma.testPlanAccess.upsert({
    where: { email },
    update: { grantedBy: auth.userId, grantedAt: new Date() },
    create: { email, grantedBy: auth.userId },
  })

  logger.info('test-plan-access: granted', { email, grantedBy: auth.userId })
  return NextResponse.json({ entry }, { status: 201 })
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const parsed = EmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ code: 'INVALID_EMAIL', message: 'A valid email is required' }, { status: 400 })
  }

  const { email } = parsed.data

  const existing = await prisma.testPlanAccess.findUnique({ where: { email } })
  if (!existing) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'Email not in whitelist' }, { status: 404 })
  }

  await prisma.testPlanAccess.delete({ where: { email } })
  logger.info('test-plan-access: revoked', { email, revokedBy: auth.userId })
  return NextResponse.json({ ok: true })
}
