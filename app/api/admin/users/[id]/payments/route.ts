/**
 * GET /api/admin/users/:id/payments
 * F-ADM-021 AC-04: Full payment event history for a student.
 *
 * Returns all Payment records and their PaymentEvent audit trail for the
 * given user, ordered by most recent first. Used for dispute resolution.
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

  // Also fetch loose PaymentEvents not linked to a Payment row (e.g. webhook failures)
  const looseEvents = await prisma.paymentEvent.findMany({
    where: { userId, paymentId: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      eventType: true,
      status: true,
      amount: true,
      provider: true,
      payload: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ payments, looseEvents, total: payments.length })
}
