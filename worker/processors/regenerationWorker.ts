import { prisma } from '@/lib/prisma.js'
import logAuditEvent from '@/lib/audit/log.js'
import { AuditEvents } from '@/lib/audit/events.js'
import generatorAdapter from '@/regeneration/generatorAdapter.js'
import { logger } from '@/lib/logger.js'

let _running = false
let _stopRequested = false

function sleep(ms: number) { return new Promise((res) => setTimeout(res, ms)) }

export async function claimJob(jobId: string) {
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

export async function processNextJob() {
  const pending = await prisma.regenerationJob.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (process.env.NODE_ENV === 'test') {
    logger.debug('regenerationWorker: pending', { pending })
  }
  if (!pending) return null

  const claimed = await claimJob(pending.id)
  if (process.env.NODE_ENV === 'test') {
    logger.debug('regenerationWorker: claimed', { claimed })
  }
  if (!claimed) return null

  try { logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_LOCKED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'RUNNING' } }) } catch {}
  try { logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_STARTED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'RUNNING' } }) } catch {}

  try {
    if (process.env.NODE_ENV === 'test') {
      logger.debug('regenerationWorker: entering generatorAdapter')
    }
    const output = await generatorAdapter({
      id: claimed.id,
      suggestionId: (claimed as any).suggestionId,
      targetType: (claimed as any).targetType,
      targetId: (claimed as any).targetId,
      instructionJson: (claimed as any).instructionJson,
    })
    if (process.env.NODE_ENV === 'test') {
      logger.debug('regenerationWorker: generator output', { output })
    }

    if (process.env.NODE_ENV === 'test') {
      logger.debug('regenerationWorker: about to call prisma.regenerationOutput.create')
    }
    const out = await prisma.regenerationOutput.create({ data: {
      jobId: claimed.id,
      targetType: (claimed as any).targetType,
      targetId: (claimed as any).targetId,
      contentJson: output.outputJson,
    } })
    if (process.env.NODE_ENV === 'test') {
      logger.debug('regenerationWorker: after prisma.regenerationOutput.create')
    }

    const outputRef = { outputId: out.id, createdAt: out.createdAt }

    try {
      const updated = await prisma.regenerationJob.updateMany({ where: { id: claimed.id, status: 'RUNNING' }, data: { status: 'COMPLETED', outputRef } as any })
      if ((updated as any).count > 0) {
        try { logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_COMPLETED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'COMPLETED', outputRef } }) } catch {}
      }
    } catch {}

    return { ...claimed, outputRef }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test') {
      logger.debug('regenerationWorker: generator error', { error: String(err) })
    }
    const errorJson = { message: String(err?.message ?? err), stack: err?.stack }
    try { await prisma.regenerationJob.update({ where: { id: claimed.id }, data: { status: 'FAILED', errorJson } }) } catch {}
    try { logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_FAILED, entityId: claimed.id, metadata: { jobId: claimed.id, status: 'FAILED', errorJson } }) } catch {}
    return claimed
  }
}

export function startWorker(opts?: { intervalMs?: number }) {
  const interval = opts?.intervalMs ?? 2000
  _running = true
  _stopRequested = false

  const runner = async () => {
    while (_running && !_stopRequested) {
      try {
        const job = await processNextJob()
        if (!job) { await sleep(interval) } else { await sleep(100) }
      } catch (err) { try { logger.error(`regenerationWorker: error ${String(err)}`) } catch {}; await sleep(interval) }
    }
    _running = false
  }

  runner()

  return {
    stop: async () => { _stopRequested = true; while (_running) await sleep(50) }
  }
}

export function isRunning() { return _running && !_stopRequested }

const workerDefault = { startWorker, stop: async () => { _stopRequested = true; while (_running) await sleep(50) }, processNextJob, claimJob }

export default workerDefault
