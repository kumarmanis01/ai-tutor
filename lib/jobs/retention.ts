import { prisma } from '@/lib/prisma';
import logAuditEvent from '@/lib/audit/log';
import { registerJob } from '@/lib/jobs/registry';

/**
 * Prune Analytics Events
 *
 * FILE OBJECTIVE:
 * - Remove rows from `AnalyticsEvent` older than `days` days to enforce retention.
 * - Record a best-effort audit entry summarising the prune.
 *
 * RETENTION POLICY:
 * - Default: 90 days. This job is idempotent and safe to run repeatedly.
 * - Acceptance: indexed queries exist on (eventType, createdAt) to support daily reports.
 *
 * Returns the number of deleted rows.
 */
export async function pruneOldAnalyticsEvents(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const res = await prisma.analyticsEvent.deleteMany({
      where: { createdAt: { lt: cutoff } } as any,
    });
    const count = (res as any)?.count ?? 0;
    try {
      await logAuditEvent(prisma, {
        targetEntity: 'System',
        targetId: 'retention',
        action: null,
        details: {
          legacyAction: 'RETENTION_PRUNE_ANALYTICS',
          days,
          cutoff: cutoff.toISOString(),
          deletedCount: count,
        },
      });
    } catch {
      // audit best-effort
    }
    return count;
  } catch (err: any) {
    try {
      await logAuditEvent(prisma, {
        targetEntity: 'System',
        targetId: 'retention',
        action: null,
        details: {
          legacyAction: 'RETENTION_PRUNE_ANALYTICS_FAILED',
          days,
          cutoff: cutoff.toISOString(),
          error: String(err?.message ?? err),
        },
      });
    } catch {}
    throw err;
  }
}

// Register as a manual job (must be invoked explicitly)
registerJob({
  name: 'prune_analytics_events',
  lockKey: 'prune_analytics_events',
  timeoutMs: 10 * 60 * 1000,
  schedule: { type: 'manual' },
  run: async () => {
    await pruneOldAnalyticsEvents(90);
  },
});

export default pruneOldAnalyticsEvents;
