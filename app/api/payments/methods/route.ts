/**
 * FILE OBJECTIVE:
 * - CRUD for persisted payment methods (list, create, update, delete)
 *
 * LINKED UNIT TEST:
 * - __tests__/app/api/payments/methods/route.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | add payment methods management routes
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET(req: Request) {
  logApiUsage('/api/payments/methods', 'GET');
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string } | null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const methods = await prisma.paymentMethod.findMany({ where: { userId: user.id }, orderBy: { isDefault: 'desc', createdAt: 'desc' } });
  return NextResponse.json({ methods }, { status: 200 });
}

export async function POST(req: Request) {
  logApiUsage('/api/payments/methods', 'POST');
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
  const providerPaymentMethodId = typeof b.providerPaymentMethodId === 'string' ? b.providerPaymentMethodId : '';
  const type = typeof b.type === 'string' ? b.type : 'card';
  const last4 = typeof b.last4 === 'string' ? b.last4 : null;
  const cardBrand = typeof b.cardBrand === 'string' ? b.cardBrand : null;
  const expiryMonth = typeof b.expiryMonth === 'number' ? b.expiryMonth : null;
  const expiryYear = typeof b.expiryYear === 'number' ? b.expiryYear : null;
  const isDefault = Boolean(b.isDefault);
  const customerId = typeof b.customerId === 'string' ? b.customerId : null;

  if (!providerPaymentMethodId) return NextResponse.json({ error: 'providerPaymentMethodId required' }, { status: 400 });

  try {
    // If marking default, clear other defaults first
    if (isDefault) {
      await prisma.paymentMethod.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }

    // Upsert by providerPaymentMethodId to avoid duplicates
    const existing = await prisma.paymentMethod.findUnique({ where: { providerPaymentMethodId },
      include: { customer: true },
    });

    if (existing) {
      const updated = await prisma.paymentMethod.update({ where: { providerPaymentMethodId }, data: { last4, cardBrand, expiryMonth, expiryYear, isDefault, meta: b.meta ?? existing.meta } });
      return NextResponse.json({ method: updated }, { status: 200 });
    }

    const created = await prisma.paymentMethod.create({
      data: {
        userId: user.id,
        customerId: customerId ?? null,
        provider: 'razorpay',
        providerPaymentMethodId,
        type,
        last4,
        cardBrand,
        expiryMonth,
        expiryYear,
        isDefault,
        verified: false,
        meta: b.meta ?? {},
      },
    });

    return NextResponse.json({ method: created }, { status: 201 });
  } catch (err) {
    logger.error('Failed to create/update payment method', { event: 'payments.methods.create', err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  logApiUsage('/api/payments/methods', 'DELETE');
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string } | null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const existing = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.paymentMethod.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    logger.error('Failed to delete payment method', { event: 'payments.methods.delete', err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export default POST;
