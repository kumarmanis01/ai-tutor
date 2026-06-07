/**
 * FILE OBJECTIVE:
 * - Allow a parent to enqueue a retry for a single failed installment they own.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-installment-retry.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | reorder session null check before role read; add header.
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { enqueueInstallmentRetry } from '@/lib/installment/retry'

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Defense in depth: explicit parent-role check on top of the link-based
  // guard further down. Without this, a student session reaching this route
  // with a known studentId could exfiltrate parent-scoped data.
  if ((session!.user as { role?: string }).role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const installmentId = String(body?.installmentId || '')
  if (!installmentId) return NextResponse.json({ error: 'Missing installmentId' }, { status: 400 })

  try {
    const inst = await prisma.installment.findUnique({ where: { id: installmentId }, select: { id: true, subscriptionId: true } })
    if (!inst) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })

    // Check ownership: subscription must belong to session user
    const sub = await prisma.subscription.findUnique({ where: { id: inst.subscriptionId }, select: { id: true, userId: true } })
    if (!sub || sub.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await enqueueInstallmentRetry({ subscriptionId: inst.subscriptionId, installmentId: inst.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('installment.retry.failed', { err: String(err), userId, installmentId })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export default POST
