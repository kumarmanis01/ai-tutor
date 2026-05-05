/**
 * GET  /api/parent/payment-methods       -- list saved payment methods (F-PAR-031 AC-01)
 * POST /api/parent/payment-methods       -- save a new tokenized payment method (F-PAR-031 AC-05)
 * DELETE /api/parent/payment-methods?id= -- remove a payment method after new one is verified (F-PAR-031 AC-05)
 *
 * Stores masked metadata only (last4, brand). Does NOT store raw PAN data.
 *
 * FILE OBJECTIVE:
 * - CRUD for parent stored payment methods.
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
 * - 2026-05-05T00:00:00Z | staff-engineer | add GET (list) + DELETE endpoints (F-PAR-031 AC-01/05)
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** GET /api/parent/payment-methods -- list saved payment methods for the authenticated parent */
export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = (session as any)?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any)?.user?.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { userId },
      select: { id: true, type: true, last4: true, cardBrand: true, expiryMonth: true, expiryYear: true, isDefault: true, verified: true, createdAt: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ methods }, { status: 200 });
  } catch (err) {
    logger.error('Failed to list payment methods', { event: 'parent.paymentMethod.list.error', context: { userId }, err });
    return NextResponse.json({ error: 'Could not load payment methods' }, { status: 500 });
  }
}

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

/**
 * DELETE /api/parent/payment-methods?id=<methodId>
 *
 * Remove a stored payment method. Only allowed when the parent has at least
 * one other verified payment method (new method validated before old is removed).
 */
export async function DELETE(req: Request) {
  const session = await getServerSessionForHandlers();
  const userId = (session as any)?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any)?.user?.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const method = await prisma.paymentMethod.findUnique({ where: { id }, select: { userId: true, isDefault: true } });
    if (!method || method.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Ensure the parent retains at least one other payment method before removing this one.
    const remaining = await prisma.paymentMethod.count({ where: { userId, id: { not: id } } });
    if (remaining === 0) {
      return NextResponse.json({ error: 'Cannot remove your only payment method' }, { status: 409 });
    }

    await prisma.paymentMethod.delete({ where: { id } });

    // If the deleted method was default, promote the most recently added method as default.
    if (method.isDefault) {
      const next = await prisma.paymentMethod.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (next) {
        await prisma.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    logger.error('Failed to delete payment method', { event: 'parent.paymentMethod.delete.error', context: { userId, id }, err });
    return NextResponse.json({ error: 'Could not remove payment method' }, { status: 500 });
  }
}

export default POST;
