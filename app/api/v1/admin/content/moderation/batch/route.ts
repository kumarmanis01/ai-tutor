/**
 * FILE OBJECTIVE:
 * - A1.1: Batch approve/reject content items from the moderation dashboard.
 *   POST /api/v1/admin/content/moderation/batch
 *   Admin-only. Creates AuditLog entries for each action.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/content/moderation/batch/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A1.1 batch moderation action route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type BatchBody = {
  ids: string[];
  action: 'approve' | 'reject' | 'archive';
  reason?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }
  if (session.user.role !== 'admin' && session.user.role !== 'moderator') {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Admin or moderator role required' }, { status: 403 });
  }

  let body: BatchBody;
  try {
    body = (await req.json()) as BatchBody;
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid request body' }, { status: 400 });
  }

  const { ids, action, reason } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'ids must be a non-empty array' }, { status: 400 });
  }
  if (!['approve', 'reject', 'archive'].includes(action)) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid action' }, { status: 400 });
  }

  const statusMap: Record<string, string> = {
    approve: 'APPROVED',
    reject: 'REJECTED',
    archive: 'ARCHIVED',
  };

  const newStatus = statusMap[action] ?? 'APPROVED';

  try {
    await prisma.$transaction(async (tx) => {
      // Fetch current statuses for audit log
      const existing = await tx.content.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true },
      });

      // Update all content statuses
      await tx.content.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus as 'APPROVED' | 'REJECTED' | 'ARCHIVED' },
      });

      // Write audit log entry per item
      await tx.auditLog.createMany({
        data: existing.map((item) => ({
          adminId: session.user.id,
          targetEntity: 'Content',
          targetId: item.id,
          action: action === 'approve' ? 'CONTENT_APPROVE' : 'CONTENT_REJECT',
          previousValue: { status: item.status },
          newValue: { status: newStatus },
          reason: reason ?? null,
          ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
        })),
      });
    });

    return NextResponse.json({ updated: ids.length });
  } catch (err: unknown) {
    logger.error('admin/content/moderation/batch: POST failed', { action, ids, error: err });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Batch action failed' }, { status: 500 });
  }
}
