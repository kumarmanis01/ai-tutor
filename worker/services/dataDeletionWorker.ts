/**
 * DPDP right-to-erasure nightly worker.
 * Runs at 02:00 AM IST (20:30 UTC previous day).
 *
 * Phase 1 (7 days after request): pseudonymise PII fields
 * Phase 2 (30 days after pseudonymise): purge remaining PII
 *
 * Never throws -- logs all errors and continues to next request.
 */

import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';
import { AdminActionType } from '@prisma/client';

const PSEUDONYMISE_AFTER_DAYS = 7;
const PURGE_AFTER_DAYS = 30;

export async function runDataDeletionCycle(): Promise<{ pseudonymised: number; purged: number }> {
  const now = new Date();
  const pseudonymiseThreshold = new Date(
    now.getTime() - PSEUDONYMISE_AFTER_DAYS * 24 * 60 * 60 * 1000
  );
  const purgeThreshold = new Date(now.getTime() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  let pseudonymised = 0;
  let purged = 0;

  // ── Phase 1: Pseudonymise ───────────────────────────────────────────────────
  const phase1Requests = await prisma.deletionRequest.findMany({
    where: { requestedAt: { lt: pseudonymiseThreshold }, pseudonymisedAt: null },
    take: 50, // batch cap per run
  });

  for (const req of phase1Requests) {
    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: req.userId },
          data: {
            name: 'Deleted User',
            email: `deleted_${req.id}@deleted.spinzy.com`,
            phone: null,
            age: null,
            parentEmail: null,
          },
        }),
        prisma.consent.deleteMany({ where: { userId: req.userId } }),
        prisma.deletionRequest.update({
          where: { id: req.id },
          data: { pseudonymisedAt: now },
        }),
        prisma.auditLog.create({
          data: {
            targetEntity: 'User',
            targetId: req.userId,
            action: AdminActionType.ERASURE_PSEUDONYMISE,
          },
        }),
      ]);
      pseudonymised++;
      logger.info('dataDeletionWorker.pseudonymised', { requestId: req.id });
    } catch (err) {
      logger.error('dataDeletionWorker.pseudonymiseFailed', {
        requestId: req.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Phase 2: PII purge ──────────────────────────────────────────────────────
  const phase2Requests = await prisma.deletionRequest.findMany({
    where: { pseudonymisedAt: { lt: purgeThreshold }, purgedAt: null },
    take: 50,
  });

  for (const req of phase2Requests) {
    try {
      // Find all session IDs for this user
      const sessions = await prisma.structuredSession.findMany({
        where: { studentId: req.userId },
        select: { id: true },
      });
      const sessionIds = sessions.map((s: { id: string }) => s.id);

      await prisma.$transaction([
        // Delete safety events
        prisma.safetyEvent.deleteMany({ where: { studentId: req.userId } }),
        // Delete doubt escalations
        prisma.doubtEscalation.deleteMany({ where: { studentId: req.userId } }),
        // Delete session question flags
        prisma.sessionQuestionFlag.deleteMany({ where: { studentId: req.userId } }),
        // Mark purge complete
        prisma.deletionRequest.update({
          where: { id: req.id },
          data: { purgedAt: now },
        }),
        // Audit (keep AuditLog for 7yr legal requirement -- use requestId not userId)
        prisma.auditLog.create({
          data: {
            targetEntity: 'DeletionRequest',
            targetId: req.id,
            action: AdminActionType.ERASURE_PURGE,
          },
        }),
      ]);

      // AITutorTurnLog: no studentMessage/rawInput fields in current schema -- skip
      void sessionIds; // suppress unused var warning

      purged++;
      logger.info('dataDeletionWorker.purged', { requestId: req.id, purgedAt: now.toISOString() });
    } catch (err) {
      logger.error('dataDeletionWorker.purgeFailed', {
        requestId: req.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('dataDeletionWorker.cycleComplete', { pseudonymised, purged });
  return { pseudonymised, purged };
}
