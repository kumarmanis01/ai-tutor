/**
 * PATCH /api/student/learning-plan/[itemId]
 *
 * Updates a LearningPlanItem's status for the authenticated student.
 * Currently supports: status = 'DEFERRED' (skip to next topic).
 *
 * Body: { status: 'DEFERRED' }
 * Auth: session required — 401 if missing.
 *       Item must belong to the current student — 404 otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

const ALLOWED_STATUSES = ['DEFERRED'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

interface Params {
  params: Promise<{ itemId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'LearningPlanItemAPI', methodName: 'PATCH' }, start);
      return res;
    }

    const { itemId } = await params;
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status: string = typeof body.status === 'string' ? body.status : '';

    if (!ALLOWED_STATUSES.includes(status as AllowedStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    // Verify the item belongs to the current student before updating
    const existing = await prisma.learningPlanItem.findFirst({
      where: { id: itemId, plan: { studentId: userId } },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updated = await prisma.learningPlanItem.update({
      where: { id: itemId },
      data: {
        status: status as AllowedStatus,
        deferredAt: status === 'DEFERRED' ? new Date() : undefined,
      },
      select: { id: true, status: true },
    });

    const res = NextResponse.json({ ok: true, item: updated });
    logger.logAPI(req, res, { className: 'LearningPlanItemAPI', methodName: 'PATCH' }, start);
    return res;
  } catch (err) {
    logger.error('LearningPlanItemAPI PATCH error', {
      className: 'LearningPlanItemAPI',
      methodName: 'PATCH',
      error: err,
    });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
