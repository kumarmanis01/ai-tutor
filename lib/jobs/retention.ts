import { prisma } from '@/lib/prisma'
import logAuditEvent from '@/lib/audit/log'
import { registerJob } from '@/lib/jobs/registry'

/**
 * Delete AnalyticsEvent rows older than `days` days.
 * Returns the number of deleted rows.
 */
export async function pruneOldAnalyticsEvents(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  try {
    const res = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } as any })
    const count = (res as any)?.count ?? 0
    try {
      await logAuditEvent(prisma, {
        action: 'RETENTION_PRUNE_ANALYTICS',
        metadata: { days, cutoff: cutoff.toISOString(), deletedCount: count }
      })
    } catch {
      // audit best-effort
    }
    return count
  } catch (err: any) {
    try {
      await logAuditEvent(prisma, { action: 'RETENTION_PRUNE_ANALYTICS_FAILED', metadata: { days, cutoff: cutoff.toISOString(), error: String(err?.message ?? err) } })
    } catch {}
    throw err
  }
}

// Register as a manual job (must be invoked explicitly)
registerJob({
  name: 'prune_analytics_events',
  lockKey: 'prune_analytics_events',
  timeoutMs: 10 * 60 * 1000,
  schedule: { type: 'manual' },
  run: async () => {
    await pruneOldAnalyticsEvents(90)
  },
})

export default pruneOldAnalyticsEvents
