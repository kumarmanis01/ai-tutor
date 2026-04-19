import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { AdminActionType } from '@prisma/client'

/**
 * POST /api/admin/subscriptions/:id/extend
 *
 * F-ADM-021 AC-01: Admin manually extends a student's subscription by N days
 * for a stated reason (goodwill, technical issue, promotional). Audit logged.
 *
 * Body: { days: number, reason: string }
 * Returns: { ok: true, newEndDate: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const days = typeof (body as any)?.days === 'number' ? (body as any).days : null
  const reason: string = typeof (body as any)?.reason === 'string' ? String((body as any).reason).trim() : ''

  if (!days || !Number.isInteger(days) || days < 1 || days > 365) {
    return NextResponse.json(
      { error: 'days_required', message: 'days must be an integer between 1 and 365' },
      { status: 400 },
    )
  }
  if (!reason) {
    return NextResponse.json(
      { error: 'reason_required', message: 'reason is required for subscription extensions' },
      { status: 400 },
    )
  }

  const subscription = await prisma.subscription.findUnique({ where: { id } })
  if (!subscription) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const previousEndDate = subscription.endDate
  const newEndDate = new Date(previousEndDate)
  newEndDate.setDate(newEndDate.getDate() + days)

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id },
      data: {
        endDate: newEndDate,
        // Ensure the subscription remains active after extension
        active: true,
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'Subscription',
        targetId: id,
        action: (AdminActionType?.SUBSCRIPTION_EXTEND) ?? 'SUBSCRIPTION_EXTEND',
        previousValue: { endDate: previousEndDate.toISOString() },
        newValue: { endDate: newEndDate.toISOString(), days, reason },
        reason,
      },
    }),
  ])

  return NextResponse.json({ ok: true, newEndDate: newEndDate.toISOString() })
}
