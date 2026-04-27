#!/usr/bin/env ts-node
import { prisma } from '@/lib/prisma'
import { JobStatus } from '@/lib/ai-engine/types'
import { logger } from '@/lib/logger'

// Simple CLI reconciler for HydrationJob hierarchy
// Usage: HYDRATION_DRY_RUN=1 node scripts/hydration-reconciler.ts

async function reconcileOne(parent: any, dryRun = false) {
  const parentId = parent.id

  // find immediate children
  const children = await prisma.hydrationJob.findMany({ where: { parentJobId: parentId } })
  if (children.length === 0) return { parentId, totalChildren: 0, completedChildren: 0, failedChildren: 0, wouldSetStatus: 'unchanged' }

  const counts = { total: children.length, completed: 0, failed: 0, pending: 0, running: 0 }
  for (const c of children) {
    if (c.status === JobStatus.Completed) counts.completed++
    else if (c.status === JobStatus.Failed) counts.failed++
    else if (c.status === JobStatus.Pending) counts.pending++
    else if (c.status === JobStatus.Running) counts.running++
  }

  // Decide desired outcome deterministically
  let desired: 'completed' | 'failed' | 'unchanged' = 'unchanged'
  if (counts.failed > 0) desired = 'failed'
  else if (counts.total > 0 && counts.completed === counts.total) desired = 'completed'

  // DRY-RUN: return computed outcome without acquiring locks or making writes
  if (dryRun) {
    return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, wouldSetStatus: desired }
  }

  // LIVE mode: acquire a TTL-based lock before making changes
  const LOCK_TTL_MS = Number(process.env.RECONCILER_LOCK_TTL_MS || 5 * 60 * 1000) // default 5 minutes
  const now = new Date()
  const lockExpiry = new Date(Date.now() - LOCK_TTL_MS)

  const lockClaim = await prisma.hydrationJob.updateMany({
    where: { id: parentId, OR: [{ lockedAt: null }, { lockedAt: { lt: lockExpiry } }] },
    data: { lockedAt: now }
  })
  if (lockClaim.count === 0) {
    logger.debug('reconciler: parent locked by another process', { parentId })
    return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, wouldSetStatus: 'locked' }
  }

  try {
    // Reload parent to ensure idempotent update decision
    const freshParent = await prisma.hydrationJob.findUnique({ where: { id: parentId } })
    if (!freshParent) return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, wouldSetStatus: 'missing_parent' }

    if (desired === 'failed') {
      if (freshParent.status !== JobStatus.Failed) {
        // Use first failed child to build an admin-readable structured lastError
        const failedChild = children.find((c: any) => c.status === JobStatus.Failed);
        let parentLastError = 'CHILD_FAILED::unknown';
        try {
          const { formatChildFailure, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
          if (failedChild) {
            const raw = failedChild.lastError || '';
            const childCode = raw.includes('::') ? raw.split('::')[0] : inferFailureCodeFromMessage(raw);
            parentLastError = formatChildFailure(String(failedChild.id), String(failedChild.jobType || 'unknown'), childCode as any);
          }
        } catch {}

        await prisma.hydrationJob.update({ where: { id: parentId }, data: { status: JobStatus.Failed, lastError: parentLastError } })
        logger.info('reconciler: marked parent failed', { parentId, counts })
        return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, setStatus: 'failed' }
      }
      return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, setStatus: 'already_failed' }
    }

    if (desired === 'completed') {
      if (freshParent.status !== JobStatus.Completed) {
        await prisma.hydrationJob.update({ where: { id: parentId }, data: { status: JobStatus.Completed, completedAt: new Date() } })
        logger.info('reconciler: marked parent completed', { parentId, counts })
        return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, setStatus: 'completed' }
      }
      return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, setStatus: 'already_completed' }
    }

    // otherwise unchanged
    logger.debug('reconciler: no state change', { parentId, counts })
    return { parentId, totalChildren: counts.total, completedChildren: counts.completed, failedChildren: counts.failed, setStatus: 'unchanged' }
  } finally {
    // release lock only if we still hold it (lockedAt == now)
    try {
      await prisma.hydrationJob.updateMany({ where: { id: parentId, lockedAt: now }, data: { lockedAt: null } })
    } catch (e) {
      logger.warn('reconciler: failed to release lock', { parentId, error: String(e) })
    }
  }
}

async function main() {
  const dryRun = process.env.HYDRATION_DRY_RUN === '1' || process.env.HYDRATION_DRY_RUN === 'true'
  const parentJobId = process.env.PARENT_JOB_ID || null
  const rootJobId = process.env.ROOT_JOB_ID || null
  logger.info('hydration-reconciler starting', { dryRun, parentJobId, rootJobId })

  let parentIds: string[] = []

  if (parentJobId) {
    parentIds = [parentJobId]
  } else if (rootJobId) {
    const rows = await prisma.$queryRaw<Array<{ parentJobId: string }>>`
      SELECT DISTINCT "parentJobId" FROM "HydrationJob" WHERE "rootJobId" = ${rootJobId} OR "id" = ${rootJobId}
    `
    parentIds = rows.map((r: any) => r.parentJobId).filter(Boolean)
  } else {
    // Find parent jobs that may require reconciliation: those having children
    const rows = await prisma.$queryRaw<Array<{ parentJobId: string }>>`
      SELECT DISTINCT "parentJobId" FROM "HydrationJob" WHERE "parentJobId" IS NOT NULL
    `
    parentIds = rows.map((r: any) => r.parentJobId).filter(Boolean)
  }

  for (const pid of parentIds) {
    const parent = await prisma.hydrationJob.findUnique({ where: { id: pid } })
    if (!parent) continue
    try {
      const res = await reconcileOne(parent, dryRun)
      logger.debug('reconciler: result', { parentId: pid, res })
    } catch (e) {
      logger.error('reconciler: failed for parent', { parentId: pid, error: String(e) })
    }
  }

  logger.info('hydration-reconciler finished')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
