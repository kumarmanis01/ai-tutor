import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { JobStatus } from '@/lib/ai-engine/types'

/**
 * Generic hydration runner utility used by workers to process a HydrationJob.
 * Responsibilities:
 * - Claim job via updateMany (idempotent claim)
 * - Mark running, increment attempts
 * - Execute provided runFn(tx, job)
 * - Persist AIContentLog inside runFn as necessary
 * - On success: mark completed and set completedAt
 * - On failure: mark failed and preserve error, keeping record immutable
 */
export async function runHydrationJob(jobId: string, runFn: (tx: any, job: any) => Promise<any>) {
  // Claim
  const claim = await prisma.hydrationJob.updateMany({ where: { id: jobId, status: JobStatus.Pending }, data: { status: JobStatus.Running, attempts: { increment: 1 }, lockedAt: new Date() } })
  if (claim.count === 0) return { claimed: false }
  const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } })
  if (!job) return { claimed: false }

  try {
    // execute in a transaction to ensure content writes are atomic
    await prisma.$transaction(async (tx: any) => {
      await runFn(tx, job)
    })

    // mark completed
    await prisma.hydrationJob.update({ where: { id: jobId }, data: { status: JobStatus.Completed, completedAt: new Date() } })
    return { claimed: true, success: true }
  } catch (e: any) {
    const raw = String(e?.message ?? e)
    try {
      const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
      const code = inferFailureCodeFromMessage(raw);
      const le = formatLastError(code, raw);
      await prisma.hydrationJob.update({ where: { id: jobId }, data: { status: JobStatus.Failed, lastError: le } })
    } catch (u) {
      logger.error('runHydrationJob: failed to mark job failed', { jobId, error: String(u) })
    }
    return { claimed: true, success: false, error: raw }
  }
}
