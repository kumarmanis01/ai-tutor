/**
 * FILE OBJECTIVE:
 * - Create or return a Razorpay customer record for the authenticated user
 *
 * LINKED UNIT TEST:
 * - __tests__/app/api/payments/customer/route.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | add payments customer create/lookup route
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRazorpay } from '@/lib/payments';
import { logger } from '@/lib/logger';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: Request) {
  logApiUsage('/api/payments/customer', 'POST');
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string; email?: string; name?: string; phone?: string } | null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Check if a PaymentCustomer already exists for this user/provider
    const existing = await prisma.paymentCustomer.findFirst({ where: { userId: user.id, provider: 'razorpay' } });
    if (existing) {
      return NextResponse.json({ customerId: existing.providerCustomerId, id: existing.id }, { status: 200 });
    }

    // Create Razorpay customer via SDK
    const client = await getRazorpay();
    if (!client) {
      logger.error('Razorpay client not available', { event: 'payments.customer.no_client', context: { userId: user.id } });
      return NextResponse.json({ error: 'Payment provider unavailable' }, { status: 503 });
    }

    const resp = await client.customers.create({
      name: user.name ?? undefined,
      email: user.email ?? undefined,
      contact: user.phone ?? undefined,
    });

    if (!resp || !resp.id) {
      logger.error('Razorpay returned no customer id', { event: 'payments.customer.create.failed', context: { userId: user.id, resp } });
      return NextResponse.json({ error: 'Could not create customer' }, { status: 502 });
    }

    const created = await prisma.paymentCustomer.create({
      data: {
        userId: user.id,
        provider: 'razorpay',
        providerCustomerId: String(resp.id),
        meta: resp,
      },
    });

    return NextResponse.json({ customerId: created.providerCustomerId, id: created.id }, { status: 200 });
  } catch (err) {
    logger.error('Failed to create payment customer', { event: 'payments.customer.create.error', err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  logApiUsage('/api/payments/customer', 'GET');
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id?: string } | null;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const customers = await prisma.paymentCustomer.findMany({ where: { userId: user.id } });
  return NextResponse.json({ customers }, { status: 200 });
}

export default POST;
