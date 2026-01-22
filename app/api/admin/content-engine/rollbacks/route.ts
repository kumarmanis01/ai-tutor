/**
 * FILE OBJECTIVE:
 * - API endpoint for content rollbacks - shows history of content revisions and rollback actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/rollbacks/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T08:10:00Z | copilot | Created rollbacks API endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/content-engine/rollbacks
 * Returns rollback-related audit logs and content version history
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch rollback-related audit logs
    const rollbackLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'rollback_note',
            'rollback_test',
            'rollback_chapter',
            'rollback_topic',
            'content_restored',
            'version_reverted',
            'moderation_reject_note',
            'moderation_reject_test',
          ],
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Also fetch approval audit trail
    const approvalAudits = await prisma.approvalAudit.findMany({
      where: {
        toStatus: { in: ['rejected', 'archived'] },
      },
      include: {
        actor: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Type definitions for Prisma results
    type AuditLogItem = typeof rollbackLogs[number];
    type ApprovalAuditItem = typeof approvalAudits[number];
    
    // Combine and format
    const rollbacks = [
      ...rollbackLogs.map((log: AuditLogItem) => ({
        id: log.id,
        action: log.action,
        adminId: log.userId,
        adminEmail: log.user?.email,
        adminName: log.user?.name,
        entityType: (log.details as Record<string, unknown>)?.entityType as string || 'content',
        entityId: (log.details as Record<string, unknown>)?.noteId as string || 
                  (log.details as Record<string, unknown>)?.testId as string || 
                  (log.details as Record<string, unknown>)?.entityId as string,
        comment: (log.details as Record<string, unknown>)?.reason as string || 
                 (log.details as Record<string, unknown>)?.comment as string,
        createdAt: log.createdAt,
        source: 'audit_log',
      })),
      ...approvalAudits.map((audit: ApprovalAuditItem) => ({
        id: audit.id,
        action: `status_change: ${audit.fromStatus} → ${audit.toStatus}`,
        adminId: audit.actorId,
        adminEmail: audit.actor?.email,
        adminName: audit.actor?.name,
        entityType: audit.entityType,
        entityId: audit.entityId,
        comment: audit.reason,
        createdAt: audit.createdAt,
        source: 'approval_audit',
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ rollbacks });
  } catch (error) {
    logger.error('[rollbacks] Failed to fetch rollback history', { error });
    return NextResponse.json({ error: 'Failed to fetch rollback history' }, { status: 500 });
  }
}
