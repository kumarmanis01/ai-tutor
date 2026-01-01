/**
 * Regeneration Worker (clean single implementation)
 * - Polls for PENDING jobs
 * - Claims a job atomically (PENDING -> RUNNING) using a transaction
 * - Emits non-blocking audit events
 * - Does NOT execute generators (execution plane implements that)
 */

import { prisma } from '@/lib/prisma'
import logAuditEvent from '@/lib/audit/log'
import { AuditEvents } from '@/lib/audit/events'
import generatorAdapter from '@/regeneration/generatorAdapter'
import { logger } from '@/lib/logger'

let _running = false
let _stopRequested = false

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

/**
 * Atomically claim a job by transitioning PENDING -> RUNNING and setting lockedAt
 * Returns the claimed job object or null if claim failed
 */
export async function claimJob(jobId: string) {
  // Atomically claim the job inside a transaction: PENDING -> RUNNING and set lockedAt
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.regenerationJob.updateMany({ where: { id: jobId, status: 'PENDING' }, data: { status: 'RUNNING', lockedAt: new Date() as any } as any })
      if ((updated as any).count === 0) return null
      const job = await tx.regenerationJob.findUnique({ where: { id: jobId } })
      return job
    })
  } catch (err) {
    try { logger?.warn?.('claimJob: transaction failed', { err }) } catch {}
    return null
  }
}

/**
 * Process the next pending job (sequential).
 * - finds oldest PENDING job
 * - claims it atomically
 * - emits non-blocking audit events (LOCKED, STARTED)
 * - does NOT execute any generator (skeleton only)
 */
export async function processNextJob() {
  // find oldest pending job
  const pending = await prisma.regenerationJob.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!pending) return null

  const claimed = await claimJob(pending.id)
  if (!claimed) return null

  // Fire-and-forget audit events; don't block on audit writes
  try {
    logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_LOCKED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'RUNNING' } })
  } catch {
    // swallow
  }
  try {
    logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_STARTED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'RUNNING' } })
  } catch {
    // swallow
  }

  // Audit: STARTED already emitted above. Execute the generator (worker-only).
  try {
    const output = await generatorAdapter({
      id: claimed.id,
      suggestionId: (claimed as any).suggestionId,
      targetType: (claimed as any).targetType,
      targetId: (claimed as any).targetId,
      instructionJson: (claimed as any).instructionJson,
    })

    // Persist immutable output
    const out = await prisma.regenerationOutput.create({ data: {
      jobId: claimed.id,
      targetType: (claimed as any).targetType,
      targetId: (claimed as any).targetId,
      contentJson: output.outputJson,
    } })

    const outputRef = { outputId: out.id, createdAt: out.createdAt }

    // Atomically write outputRef and mark COMPLETED only if status is still RUNNING.
    try {
      const updated = await prisma.regenerationJob.updateMany({ where: { id: claimed.id, status: 'RUNNING' }, data: { status: 'COMPLETED', outputRef } as any })
      if ((updated as any).count > 0) {
        try { logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_COMPLETED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'COMPLETED', outputRef } }) } catch {}
      }
    } catch {
      // ignore execution errors — do not throw from worker
    }

    return { ...claimed, outputRef }
  } catch (err: any) {
    // Mark FAILED and write errorJson; do not throw
    const errorJson = { message: String(err?.message ?? err), stack: err?.stack }
    try {
      await prisma.regenerationJob.update({ where: { id: claimed.id }, data: { status: 'FAILED', errorJson } })
    } catch {}
    try { logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_FAILED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'FAILED', errorJson } }) } catch {}
    return claimed
  }
}

/**
 * Start a background loop that processes pending jobs sequentially.
 * Returns a handle with `stop()` to request shutdown.
 */
export function startWorker(opts?: { intervalMs?: number }) {
  const interval = opts?.intervalMs ?? 2000
  _running = true
  _stopRequested = false

  const runner = async () => {
    while (_running && !_stopRequested) {
      try {
        const job = await processNextJob()
        if (!job) {
          // nothing to do, sleep
          await sleep(interval)
        } else {
          // found and claimed a job; small backoff before next
          await sleep(100)
        }
      } catch (err) {
        try { logger.error(`regenerationWorker: error ${String(err)}`) } catch {}
        await sleep(interval)
      }
    }
    _running = false
  }

  runner()

  return {
    stop: async () => {
      _stopRequested = true
      // wait until runner clears
      while (_running) await sleep(50)
    }
  }
}

export function isRunning() {
  return _running && !_stopRequested
}

const workerDefault = {
  startWorker,
  stop: async () => {
    _stopRequested = true
    while (_running) await sleep(50)
  },
  processNextJob,
  claimJob,
}

export default workerDefault
