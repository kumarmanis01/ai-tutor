/**
 * POST /api/parent/payment-methods
 *
 * Save a tokenized payment method for a parent (provider customer id + payment method id).
 * This API stores masked metadata only (last4, brand) and provider references required
 * for server-side retry/auto-charge flows. It does NOT store raw PAN data.
 *
 * FILE OBJECTIVE:
 * - Accept a provider token and persist a PaymentCustomer + PaymentMethod record.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-payment-methods.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | add parent payment-methods POST endpoint
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const userId = (session as any)?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any)?.user?.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const provider = typeof b.provider === 'string' ? b.provider : 'razorpay';
  const providerCustomerId = typeof b.providerCustomerId === 'string' ? b.providerCustomerId : undefined;
  const providerPaymentMethodId = typeof b.providerPaymentMethodId === 'string' ? b.providerPaymentMethodId : undefined;
  const type = typeof b.type === 'string' ? b.type : '';
  const last4 = typeof b.last4 === 'string' ? b.last4 : undefined;
  const cardBrand = typeof b.cardBrand === 'string' ? b.cardBrand : undefined;
  const expiryMonth = typeof b.expiryMonth === 'number' ? b.expiryMonth : undefined;
  const expiryYear = typeof b.expiryYear === 'number' ? b.expiryYear : undefined;
  const isDefault = Boolean(b.isDefault === true || b.isDefault === 'true');
  const verified = Boolean(b.verified === true || b.verified === 'true');
  const meta = b.meta ?? null;

  if (!providerPaymentMethodId) {
    return NextResponse.json({ error: 'Missing providerPaymentMethodId' }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Find or create customer record
      let customer = null as any;
      if (providerCustomerId) {
        customer = await tx.paymentCustomer.findUnique({ where: { providerCustomerId } });
      }
      if (!customer) {
        customer = await tx.paymentCustomer.create({ data: { userId, provider, providerCustomerId: providerCustomerId ?? null, meta: null } });
      }

      // If this method should be default, clear existing default flags
      if (isDefault) {
        await tx.paymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      const pm = await tx.paymentMethod.create({
        data: {
          userId,
          customerId: customer?.id ?? null,
          provider,
          providerPaymentMethodId,
          type,
          last4: last4 ?? null,
          cardBrand: cardBrand ?? null,
          expiryMonth: expiryMonth ?? null,
          expiryYear: expiryYear ?? null,
          isDefault,
          verified,
          meta: meta as any,
        },
      });

      return pm;
    });

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (err) {
    logger.error('Failed to save payment method', { event: 'parent.paymentMethod.save.error', context: { userId }, err });
    return NextResponse.json({ error: 'Could not save payment method' }, { status: 500 });
  }
}

export default POST;
