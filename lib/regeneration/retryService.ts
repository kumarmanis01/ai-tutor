import { PrismaClient } from '@prisma/client'
import makeRetryIntentStore from '../retryIntent/store'
import { logAuditEvent } from '../audit/log'

export function makeRetryService(prisma: PrismaClient) {
  async function createRetryJobFromIntent(intentId: string) {
    return prisma.$transaction(async (tx) => {
      const store = makeRetryIntentStore(tx as unknown as PrismaClient)

      // Ensure this intent has not already produced a job
      // Support various mocked transaction clients in tests: prefer findFirst, fall back to findUnique or findMany
      let existing: any = null
      if (typeof (tx.regenerationJob as any).findFirst === 'function') {
        existing = await (tx.regenerationJob as any).findFirst({ where: { retryIntentId: intentId } })
      } else if (typeof (tx.regenerationJob as any).findUnique === 'function') {
        existing = await (tx.regenerationJob as any).findUnique({ where: { retryIntentId: intentId } })
      } else if (typeof (tx.regenerationJob as any).findMany === 'function') {
        const arr = await (tx.regenerationJob as any).findMany({ where: { retryIntentId: intentId }, take: 1 })
        existing = arr && arr.length ? arr[0] : null
      }
      if (existing) throw new Error('retry intent already executed')

      // Consume intent (PENDING -> CONSUMED) using store inside tx
      const consumed = await store.consumeRetryIntent(intentId)

      // Load the source job to copy instructionJson
      const sourceJob = await tx.regenerationJob.findUnique({ where: { id: consumed?.sourceJobId } })
      if (!sourceJob) throw new Error('source job not found')

      // Create new regeneration job referencing the intent and source job
      const created = await tx.regenerationJob.create({
        data: {
          suggestionId: sourceJob.suggestionId ?? '',
          targetType: sourceJob.targetType as any,
          targetId: sourceJob.targetId,
          instructionJson: sourceJob.instructionJson as any,
          status: 'PENDING',
          retryOfJobId: sourceJob.id,
          retryIntentId: intentId,
          createdBy: sourceJob.createdBy ?? 'system',
        },
      })

      // created job

      // Emit audit (non-blocking)
      try {
        logAuditEvent(prisma, {
          action: 'REGEN_JOB_RETRIED',
          entityId: created.id,
          metadata: { sourceJobId: sourceJob.id, retryIntentId: intentId },
        })
      } catch {
        // swallow
      }

      return created
    })
  }

  return { createRetryJobFromIntent }
}

export type RetryService = ReturnType<typeof makeRetryService>

export default makeRetryService
