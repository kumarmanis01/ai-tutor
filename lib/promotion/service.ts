import { PrismaClient } from '@prisma/client'
import makePromotionStore from './store'
import { logAuditEvent } from '@/lib/audit/log'

export default function makePromotionService(prisma: PrismaClient) {

  async function approveCandidate(candidateId: string, actorId: string, notes?: any) {
    return prisma.$transaction(async (tx) => {
      const s = makePromotionStore(tx as unknown as PrismaClient)
      const candidate = await s.getCandidateById(candidateId)
      if (!candidate) throw new Error('candidate not found')
      if (candidate.status === 'APPROVED') throw new Error('candidate already approved')
      if (candidate.status === 'REJECTED') throw new Error('candidate already rejected')

      // Replace any existing published pointer for the scope
      await tx.publishedOutput.deleteMany({ where: { scope: candidate.scope as any, scopeRefId: candidate.scopeRefId } })

      const published = await tx.publishedOutput.create({ data: {
        scope: candidate.scope as any,
        scopeRefId: candidate.scopeRefId,
        outputRef: candidate.outputRef,
        promotedBy: actorId,
      } })

      // mark candidate approved
      await tx.promotionCandidate.update({ where: { id: candidateId }, data: { status: 'APPROVED', reviewedBy: actorId, reviewedAt: new Date(), reviewNotes: notes as any } })

      // audit
      try {
        logAuditEvent(prisma as any, { action: 'PROMOTION_APPROVED', entityId: candidateId, actorId, metadata: { publishedId: published.id, scope: candidate.scope, scopeRefId: candidate.scopeRefId } })
      } catch {}

      return published
    })
  }

  async function rejectCandidate(candidateId: string, actorId: string, notes?: any) {
    const cand = await prisma.promotionCandidate.findUnique({ where: { id: candidateId } })
    if (!cand) throw new Error('candidate not found')
    if (cand.status === 'APPROVED') throw new Error('cannot reject approved candidate')
    if (cand.status === 'REJECTED') throw new Error('candidate already rejected')

    const updated = await prisma.promotionCandidate.update({ where: { id: candidateId }, data: { status: 'REJECTED', reviewedBy: actorId, reviewedAt: new Date(), reviewNotes: notes as any } })

    try {
      logAuditEvent(prisma as any, { action: 'PROMOTION_REJECTED', entityId: candidateId, actorId, metadata: { scope: cand.scope, scopeRefId: cand.scopeRefId } })
    } catch {}

    return updated
  }

  return { approveCandidate, rejectCandidate }
}

export type PromotionService = ReturnType<typeof makePromotionService>
