/**
 * FILE OBJECTIVE:
 * - Verify a stored payment method by performing a small tokenized charge.
 *
 * LINKED UNIT TEST:
 * - tests/integration/payment_methods.integration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | add payment method verification route
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { createRazorpayTokenCharge } from '@/lib/payments';
import { recordPaymentEvent } from '@/lib/payments/audit';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: Request) {
  logApiUsage('/api/payments/methods/verify', 'POST');
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string } | null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, any>;
  const methodId = typeof b.methodId === 'string' ? b.methodId : null;
  const providerPaymentMethodId = typeof b.providerPaymentMethodId === 'string' ? b.providerPaymentMethodId : null;

  if (!methodId && !providerPaymentMethodId) return NextResponse.json({ error: 'methodId or providerPaymentMethodId required' }, { status: 400 });

  try {
    const method = methodId
      ? await prisma.paymentMethod.findUnique({ where: { id: methodId }, include: { customer: true } })
      : await prisma.paymentMethod.findFirst({ where: { providerPaymentMethodId }, include: { customer: true } });

    if (!method) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    if (method.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Attempt a small charge (1 INR) to verify the method via tokenized charge
    const amountPaise = 100; // 1 INR
    // Ensure idempotency for this verification charge so retries are safe
    const providedKey = (req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || '') as string
    const providerIdempotencyKey = providedKey || randomUUID()

    const resp = await createRazorpayTokenCharge({ amountPaise, customerId: method.customer?.providerCustomerId ?? undefined, token: method.providerPaymentMethodId, idempotencyKey: providerIdempotencyKey });

    if (!resp) {
      return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 400 });
    }

    // Mark method verified and persist a Payment record for audit
    await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({ data: { userId: user.id, amount: amountPaise, provider: 'razorpay', providerIdempotencyKey: providerIdempotencyKey, status: 'success', transactionId: resp.id ?? resp.razorpay_payment_id ?? null, orderId: resp.order_id ?? null, meta: resp } })
      await tx.paymentMethod.update({ where: { id: method.id }, data: { verified: true, updatedAt: new Date() } })
      // Audit
      await recordPaymentEvent(tx, { paymentId: p.id, userId: user.id, provider: 'razorpay', providerIdempotencyKey: providerIdempotencyKey, transactionId: resp.id ?? resp.razorpay_payment_id ?? null, orderId: resp.order_id ?? null, eventType: 'payment.method_verification', amount: amountPaise, status: 'success', payload: resp })
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    logger.error('Payment method verification failed', { event: 'payments.methods.verify', err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export default POST;
