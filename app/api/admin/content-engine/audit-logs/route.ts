/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch content engine audit logs for the admin dashboard.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/audit-logs/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T03:30:00Z | copilot | Created audit-logs API for content engine
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/content-engine/audit-logs
 * Returns recent content engine audit logs (approval actions, job actions, etc.)
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch content engine related audit logs
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: 'approve' } },
          { action: { contains: 'reject' } },
          { action: { contains: 'job' } },
          { action: { contains: 'WORKER' } },
          { action: { contains: 'cancel' } },
          { action: { contains: 'retry' } },
          { action: { contains: 'requeue' } },
        ]
      },
      include: {
        user: { select: { email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Transform logs to the format expected by the UI
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      adminId: log.userId,
      adminEmail: log.user?.email || null,
      entityType: (log.details as Record<string, unknown>)?.entityType || extractEntityType(log.action),
      entityId: extractEntityId(log.details as Record<string, unknown>),
      comment: (log.details as Record<string, unknown>)?.reason || null,
      createdAt: log.createdAt,
      details: log.details,
    }));

    return NextResponse.json({ logs: transformedLogs });
  } catch (error) {
      logger.error('Failed to fetch audit logs', { className: 'audit-logs', methodName: 'GET', error });
      return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

/**
 * Extract entity type from action string (e.g., 'approve_topic' -> 'topic')
 */
function extractEntityType(action: string): string | null {
  if (action.includes('topic')) return 'topic';
  if (action.includes('chapter')) return 'chapter';
  if (action.includes('note')) return 'note';
  if (action.includes('test')) return 'test';
  if (action.includes('job')) return 'job';
  if (action.includes('WORKER')) return 'worker';
  return null;
}

/**
 * Extract entity ID from details object
 */
function extractEntityId(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  return (
    (details.topicId as string) ||
    (details.chapterId as string) ||
    (details.noteId as string) ||
    (details.testId as string) ||
    (details.jobId as string) ||
    (details.workerId as string) ||
    null
  );
}
