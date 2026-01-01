import { PrismaClient } from '@prisma/client'
import { logAuditEvent } from '@/lib/audit/log'

export type CreatePromotionCandidateInput = {
  scope: 'COURSE' | 'MODULE' | 'LESSON'
  scopeRefId: string
  regenerationJobId: string
  outputRef: string
  createdBy: string
}

export default function makePromotionStore(prisma: PrismaClient) {
  async function createPromotionCandidate(input: CreatePromotionCandidateInput) {
    // ensure referenced regeneration job exists
    const job = await prisma.regenerationJob.findUnique({ where: { id: input.regenerationJobId }, select: { id: true } })
    if (!job) throw new Error('regeneration job not found')

    const created = await prisma.promotionCandidate.create({ data: {
      scope: input.scope as any,
      scopeRefId: input.scopeRefId,
      regenerationJobId: input.regenerationJobId,
      outputRef: input.outputRef,
      status: 'PENDING',
      createdBy: input.createdBy,
    } })

    // audit (best-effort)
    try {
      logAuditEvent(prisma as any, { action: 'PROMOTION_CANDIDATE_CREATED', entityId: created.id, actorId: input.createdBy, metadata: { scope: input.scope, scopeRefId: input.scopeRefId, regenerationJobId: input.regenerationJobId } })
    } catch {}

    return created
  }

  async function listCandidatesByScope(scope: string, scopeRefId?: string) {
    const where: any = { scope }
    if (scopeRefId) where.scopeRefId = scopeRefId
    return prisma.promotionCandidate.findMany({ where, orderBy: { createdAt: 'desc' } })
  }

  async function getCandidateById(id: string) {
    return prisma.promotionCandidate.findUnique({ where: { id } })
  }

  return { createPromotionCandidate, listCandidatesByScope, getCandidateById }
}

export type PromotionStore = ReturnType<typeof makePromotionStore>
