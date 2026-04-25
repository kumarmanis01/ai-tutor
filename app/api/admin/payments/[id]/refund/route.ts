import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { AdminActionType } from '@prisma/client';

/**
 * POST /api/admin/payments/:id/refund
 *
 * F-ADM-021 AC-02: Admin marks a payment as manually refunded in-system.
 * The actual Razorpay refund must be initiated separately via the Razorpay
 * dashboard -- both steps are required for reconciliation.
 *
 * Body: { reason: string }
 * Returns: { ok: true }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reason: string =
    typeof (body as any)?.reason === 'string' ? String((body as any).reason).trim() : '';

  if (!reason) {
    return NextResponse.json(
      { error: 'reason_required', message: 'reason is required for manual refunds' },
      { status: 400 }
    );
  }

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (payment.status === 'refunded') {
    return NextResponse.json(
      { error: 'already_refunded', message: 'Payment is already marked as refunded' },
      { status: 409 }
    );
  }

  const previousStatus = payment.status;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id },
      data: { status: 'refunded' },
    }),
    // Immutable audit trace on the payment event log
    prisma.paymentEvent.create({
      data: {
        paymentId: id,
        userId: payment.userId,
        provider: payment.provider,
        eventType: 'admin.manual_refund',
        status: 'refunded',
        amount: payment.amount,
        payload: { reason, adminId: session.user.id },
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'Payment',
        targetId: id,
        action: AdminActionType?.SUBSCRIPTION_REFUND ?? 'SUBSCRIPTION_REFUND',
        previousValue: { status: previousStatus },
        newValue: { status: 'refunded' },
        reason,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
