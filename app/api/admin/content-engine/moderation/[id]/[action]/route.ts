/**
 * FILE OBJECTIVE:
 * - API endpoint for moderation actions (approve/reject content).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/moderation/[id]/[action]/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T08:05:00Z | copilot | Created moderation action API endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: {
    id: string;
    action: 'approve' | 'reject';
  };
}

/**
 * POST /api/admin/content-engine/moderation/[id]/[action]
 * Approves or rejects a piece of content
 */
export async function POST(req: Request, { params }: RouteParams) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, action } = params;

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  try {
    // Try to find and update note first
    const note = await prisma.topicNote.findUnique({ where: { id } });
    if (note) {
      await prisma.topicNote.update({
        where: { id },
        data: { status: newStatus },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: `moderation_${action}_note`,
          details: { noteId: id, newStatus },
        },
      });

      logger.info(`[moderation] Note ${action}d`, { noteId: id, adminId: session.user.id });
      return NextResponse.json({ success: true, type: 'note', status: newStatus });
    }

    // Try to find and update test
    const test = await prisma.generatedTest.findUnique({ where: { id } });
    if (test) {
      await prisma.generatedTest.update({
        where: { id },
        data: { status: newStatus },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: `moderation_${action}_test`,
          details: { testId: id, newStatus },
        },
      });

      logger.info(`[moderation] Test ${action}d`, { testId: id, adminId: session.user.id });
      return NextResponse.json({ success: true, type: 'test', status: newStatus });
    }

    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  } catch (error) {
    logger.error(`[moderation] Failed to ${action} content`, { id, error });
    return NextResponse.json({ error: `Failed to ${action} content` }, { status: 500 });
  }
}
