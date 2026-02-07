import { PrismaClient, Prisma } from '@prisma/client'
import { logAuditEvent } from '../audit/log'

export type CreateRetryIntentInput = {
  sourceJobId: string
  sourceOutputRef?: any
  reasonCode: any
  reasonText: string
  approvedBy: string
  approvedAt?: Date
}

export function makeRetryIntentStore(prisma: PrismaClient) {
  async function createRetryIntent(input: CreateRetryIntentInput) {
    // validate job exists and is FAILED
    const job = await prisma.regenerationJob.findUnique({
      where: { id: input.sourceJobId },
      select: { id: true, status: true },
    })

    if (!job) throw new Error('source job not found')
    if (job.status !== 'FAILED') {
      throw new Error('only FAILED jobs may be retried')
    }

    const created = await prisma.retryIntent.create({
      data: {
        sourceJobId: input.sourceJobId,
        sourceOutputRef: input.sourceOutputRef as any,
        reasonCode: input.reasonCode as any,
        reasonText: input.reasonText,
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
        status: 'PENDING',
      },
    })


    // fire-and-forget audit (non-blocking)
    try {
      logAuditEvent(prisma, {
        action: 'RETRY_INTENT_CREATED',
        entityId: created.id,
        metadata: { sourceJobId: input.sourceJobId, approvedBy: input.approvedBy },
      })
    } catch {
      // swallow errors — auditing must not break flow
    }

    return created
  }

  async function consumeRetryIntent(id: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma

    // Attempt guarded update: only transition PENDING -> CONSUMED
    const res = await client.retryIntent.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CONSUMED' },
    })

    if (res.count === 0) {
      // Determine whether it was already consumed or missing
      const existing = await client.retryIntent.findUnique({ where: { id }, select: { id: true, status: true } })
      if (!existing) throw new Error('retry intent not found')
      throw new Error('retry intent already consumed or rejected')
    }

    // Emit audit event (non-blocking)
    try {
      logAuditEvent(prisma, {
        action: 'RETRY_INTENT_CONSUMED',
        entityId: id,
      })
    } catch {
      // swallow
    }

    // return the consumed record
    const consumed = await client.retryIntent.findUnique({ where: { id } })
    return consumed
  }

  async function listRetryIntentsForJob(jobId: string) {
    return prisma.retryIntent.findMany({ where: { sourceJobId: jobId }, orderBy: { createdAt: 'desc' } })
  }

  return { createRetryIntent, consumeRetryIntent, listRetryIntentsForJob }
}

export type RetryIntentStore = ReturnType<typeof makeRetryIntentStore>

export default makeRetryIntentStore
