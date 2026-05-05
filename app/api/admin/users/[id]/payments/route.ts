/**
 * FILE OBJECTIVE:
 * - Returns full payment event history for a student for admin dispute resolution.
 * - Fetches Payment rows (with nested PaymentEvent audit trail) plus loose
 *   PaymentEvents not linked to a Payment row (e.g. early webhook.received rows
 *   written before userId is populated). Loose events are resolved via orderId
 *   cross-reference so no gateway events are missed.
 * - F-ADM-021 AC-04.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/users_payments.spec.ts (pending -- tests deferred per sprint plan)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-04T20:00:00Z | claude | created for F-ADM-021 AC-04 audit pass
 * - 2026-05-04T21:00:00Z | claude | fix: include orderId-correlated loose events missing userId
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: userId } = await params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      provider: true,
      status: true,
      plan: true,
      billingCycle: true,
      transactionId: true,
      orderId: true,
      createdAt: true,
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          eventType: true,
          status: true,
          amount: true,
          provider: true,
          payload: true,
          createdAt: true,
        },
      },
    },
  })

  // Collect all orderIds from this user's payments so we can correlate loose
  // webhook rows that were written before userId was resolved (e.g. the initial
  // 'webhook.received' event arrives before order lookup completes).
  const knownOrderIds = payments
    .map((p) => p.orderId)
    .filter((id): id is string => id !== null && id !== undefined)

  // Loose events: not linked to a Payment row. Match by userId (when set) OR
  // by orderId cross-reference (when userId was not yet resolved at write time).
  const looseEvents = await prisma.paymentEvent.findMany({
    where: {
      paymentId: null,
      OR: [
        { userId },
        ...(knownOrderIds.length > 0 ? [{ orderId: { in: knownOrderIds } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      eventType: true,
      status: true,
      amount: true,
      provider: true,
      orderId: true,
      payload: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ payments, looseEvents, total: payments.length })
}
