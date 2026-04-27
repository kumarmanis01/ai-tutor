export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - GET /api/parent/subscription/schedule
 *   Returns the EMI instalment schedule for the parent's active annual subscription.
 *   F-PAR-031 AC-06: parent can view EMI schedule; individual EMI failures
 *   handled same as subscription payment failure (grace period per instalment).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription-schedule.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-14 | claude | created for F-PAR-031 AC-06
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentSubscriptionScheduleAPI';

interface InstallmentRow {
  id: string;
  number: number;
  dueAt: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  providerPaymentId: string | null;
}

interface ScheduleResponse {
  subscriptionId: string;
  billingCycle: string;
  startDate: string;
  endDate: string;
  installments: InstallmentRow[];
}

/**
 * GET /api/parent/subscription/schedule
 * Returns EMI instalment schedule for the parent's active annual subscription.
 * Query params:
 *   studentId (optional) -- if supplied, restrict to subscription for that child
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parentId = session.user.id;
    const studentId = req.nextUrl.searchParams.get('studentId') ?? undefined;

    // Fetch the most recent active annual subscription for this parent
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: parentId,
        billingCycle: 'annual',
        active: true,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        installments: {
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No active annual subscription found' }, { status: 404 });
    }

    // If studentId supplied, verify the link is active before returning billing data
    if (studentId) {
      const link = await prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId, studentId } },
        select: { status: true },
      });
      if (!link || link.status !== 'active') {
        return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
      }
    }

    const installments: InstallmentRow[] = subscription.installments.map((inst) => ({
      id: inst.id,
      number: inst.number,
      dueAt: inst.dueAt.toISOString(),
      amount: inst.amount,
      currency: inst.currency,
      status: inst.status,
      paidAt: inst.paidAt ? inst.paidAt.toISOString() : null,
      providerPaymentId: inst.providerPaymentId ?? null,
    }));

    const payload: ScheduleResponse = {
      subscriptionId: subscription.id,
      billingCycle: subscription.billingCycle,
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate.toISOString(),
      installments,
    };

    logger.info('EMI schedule fetched', { className: CLASS_NAME, parentId, subscriptionId: subscription.id });

    const response = NextResponse.json(payload);
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'GET' }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch EMI schedule', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
