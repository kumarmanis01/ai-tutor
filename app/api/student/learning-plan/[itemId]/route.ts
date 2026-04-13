/**
 * PATCH /api/student/learning-plan/[itemId]
 *
 * Updates a LearningPlanItem's status for the authenticated student.
 * Currently supports: status = 'DEFERRED' (skip to next topic).
 *
 * Body: { status: 'DEFERRED' }
 * Auth: session required -- 401 if missing.
 *       Item must belong to the current student -- 404 otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

const ALLOWED_STATUSES = ['DEFERRED'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];
const ALLOWED_ACTIONS = ['reorder', 'move'] as const;

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
    const action: string = typeof body.action === 'string' ? body.action : '';
    const status: string = typeof body.status === 'string' ? body.status : '';

    // ── AC-06: Reorder/Move -- support moving an item relative to its neighbors
    // New: action === 'move' with { direction: 'next' | 'prev' } will swap orderInWeek
    if (action === 'move') {
      // Move direction: 'next' or 'prev' (relative within same week)
      const direction = typeof body.direction === 'string' ? body.direction : '';
      if (!['next', 'prev'].includes(direction)) {
        return NextResponse.json({ error: 'direction must be next or prev' }, { status: 400 });
      }

      const srcItem = await prisma.learningPlanItem.findFirst({
        where: { id: itemId, plan: { studentId: userId } },
        select: { id: true, planId: true, weekNumber: true, orderInWeek: true },
      });
      if (!srcItem) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

      const targetOrder = direction === 'next' ? srcItem.orderInWeek + 1 : srcItem.orderInWeek - 1;
      const tgtItem = await prisma.learningPlanItem.findFirst({
        where: { planId: srcItem.planId, weekNumber: srcItem.weekNumber, orderInWeek: targetOrder },
        select: { id: true, planId: true, weekNumber: true, orderInWeek: true },
      });
      if (!tgtItem) {
        return NextResponse.json({ error: 'No adjacent item to swap with' }, { status: 400 });
      }

      // Swap orderInWeek atomically
      await prisma.$transaction([
        prisma.learningPlanItem.update({ where: { id: srcItem.id }, data: { orderInWeek: tgtItem.orderInWeek } }),
        prisma.learningPlanItem.update({ where: { id: tgtItem.id }, data: { orderInWeek: srcItem.orderInWeek } }),
      ]);

      const res = NextResponse.json({ ok: true });
      logger.logAPI(req, res, { className: 'LearningPlanItemAPI', methodName: 'PATCH' }, start);
      return res;
    }

    // ── AC-06: Reorder -- swap orderInWeek between two items in the same week ──
    if (action === 'reorder') {
      const targetItemId = typeof body.targetItemId === 'string' ? body.targetItemId.trim() : '';
      if (!targetItemId) {
        return NextResponse.json({ error: 'targetItemId is required for reorder' }, { status: 400 });
      }
      if (targetItemId === itemId) {
        return NextResponse.json({ error: 'targetItemId must differ from itemId' }, { status: 400 });
      }

      const [srcItem, tgtItem] = await Promise.all([
        prisma.learningPlanItem.findFirst({
          where: { id: itemId, plan: { studentId: userId } },
          select: { id: true, planId: true, weekNumber: true, orderInWeek: true },
        }),
        prisma.learningPlanItem.findFirst({
          where: { id: targetItemId, plan: { studentId: userId } },
          select: { id: true, planId: true, weekNumber: true, orderInWeek: true },
        }),
      ]);
      if (!srcItem || !tgtItem) {
        return NextResponse.json({ error: 'One or both items not found' }, { status: 404 });
      }
      if (srcItem.planId !== tgtItem.planId || srcItem.weekNumber !== tgtItem.weekNumber) {
        return NextResponse.json({ error: 'Items must be in the same plan week to reorder' }, { status: 400 });
      }

      // Swap orderInWeek atomically
      await prisma.$transaction([
        prisma.learningPlanItem.update({ where: { id: srcItem.id }, data: { orderInWeek: tgtItem.orderInWeek } }),
        prisma.learningPlanItem.update({ where: { id: tgtItem.id }, data: { orderInWeek: srcItem.orderInWeek } }),
      ]);

      const res = NextResponse.json({ ok: true });
      logger.logAPI(req, res, { className: 'LearningPlanItemAPI', methodName: 'PATCH' }, start);
      return res;
    }

    // ── Status update (DEFERRED etc.) ─────────────────────────────────────────
    if (!status || !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
      return NextResponse.json(
        { error: `Provide action (${ALLOWED_ACTIONS.join(', ')}) or status (${ALLOWED_STATUSES.join(', ')})` },
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
