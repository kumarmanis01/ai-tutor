import { PrismaClient } from '@prisma/client';
import makePromotionStore from './store';
import { logAuditEvent } from '@/lib/audit/log';

export default function makePromotionService(prisma: PrismaClient) {
  async function approveCandidate(candidateId: string, actorId: string, notes?: any) {
    return prisma.$transaction(async (tx) => {
      const s = makePromotionStore(tx as unknown as PrismaClient);
      const candidate = await s.getCandidateById(candidateId);
      if (!candidate) throw new Error('candidate not found');
      if (candidate.status === 'APPROVED') throw new Error('candidate already approved');
      if (candidate.status === 'REJECTED') throw new Error('candidate already rejected');

      // PublishedOutput removed in schema_audit_cleanup -- promotion
      // now handled by HydrationJob completion directly

      // mark candidate approved
      const approved = await tx.promotionCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'APPROVED',
          reviewedBy: actorId,
          reviewedAt: new Date(),
          reviewNotes: notes as any,
        },
      });

      // audit
      try {
        logAuditEvent(prisma as any, {
          targetEntity: 'Promotion',
          targetId: candidateId,
          adminId: actorId ?? null,
          action: null,
          details: {
            legacyAction: 'PROMOTION_APPROVED',
            scope: candidate.scope,
            scopeRefId: candidate.scopeRefId,
          },
        });
      } catch {}

      return approved;
    });
  }

  async function rejectCandidate(candidateId: string, actorId: string, notes?: any) {
    const cand = await prisma.promotionCandidate.findUnique({ where: { id: candidateId } });
    if (!cand) throw new Error('candidate not found');
    if (cand.status === 'APPROVED') throw new Error('cannot reject approved candidate');
    if (cand.status === 'REJECTED') throw new Error('candidate already rejected');

    const updated = await prisma.promotionCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'REJECTED',
        reviewedBy: actorId,
        reviewedAt: new Date(),
        reviewNotes: notes as any,
      },
    });

    try {
      logAuditEvent(prisma as any, {
        targetEntity: 'Promotion',
        targetId: candidateId,
        adminId: actorId ?? null,
        action: null,
        details: {
          legacyAction: 'PROMOTION_REJECTED',
          scope: cand.scope,
          scopeRefId: cand.scopeRefId,
        },
      });
    } catch {}

    return updated;
  }

  return { approveCandidate, rejectCandidate };
}

export type PromotionService = ReturnType<typeof makePromotionService>;
