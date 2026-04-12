/**
 * FILE OBJECTIVE:
 * - Create a small Razorpay order for tokenization / card save via Checkout
 *
 * LINKED UNIT TEST:
 * - __tests__/app/api/payments/checkout/session/route.ts.test.ts
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | add checkout session endpoint
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRazorpay } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: Request) {
  logApiUsage('/api/payments/checkout/session', 'POST');
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string; email?: string; phone?: string } | null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const amountPaise = typeof (body as any).amountPaise === 'number' ? (body as any).amountPaise : 100; // default 1 INR

  try {
    const client = await getRazorpay();
    if (!client) {
      logger.error('Razorpay client not available', { event: 'payments.checkout.session.no_client', context: { userId: user.id } });
      return NextResponse.json({ error: 'Payment provider unavailable' }, { status: 503 });
    }

    const order = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `save_pm_${user.id}_${Date.now()}`,
      notes: { purpose: 'save_payment_method', userId: user.id },
    });

    // Persist a lightweight PaymentOrder for traceability
    await prisma.paymentOrder.create({ data: { studentId: user.id, razorpayOrderId: order.id, amount: amountPaise, currency: 'INR', status: 'created' } });

    return NextResponse.json({ orderId: order.id, amount: amountPaise, currency: 'INR', keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? '' }, { status: 200 });
  } catch (err) {
    logger.error('Failed to create checkout session', { event: 'payments.checkout.session.error', err });
    return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 });
  }
}

export default POST;
