import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ensureMinimumMocks } from '@/lib/mock/ensureMocks';

export interface SeedMocksJobData {
  minPer?: number;
  subjectId?: string;
  operatorId?: string;
  dryRun?: boolean;
}

/**
 * Worker handler for seed-mocks jobs. Runs in worker runtime where LLM calls
 * are allowed (if used by ensureQuestions fallback).
 */
export async function processSeedMocks(data: SeedMocksJobData) {
  const minPer = Number(data.minPer ?? 5);
  const dryRun = !!data.dryRun;
  const subjectId = data.subjectId;

  logger.info('[seed-mocks] starting', { minPer, dryRun, subjectId, operatorId: data.operatorId });

  try {
    const res = await ensureMinimumMocks({ minPer, dryRun });

    // Persist an audit record for operator visibility
    try {
      await prisma.auditLog.create({
        data: {
          adminId: data.operatorId ?? null,
          targetEntity: 'SeedMocks',
          targetId: subjectId ?? 'ALL',
          action: 'CONTENT_HYDRATE',
          details: { minPer, dryRun, createdCount: res.created.length },
        },
      });
    } catch (e) {
      logger.warn('[seed-mocks] failed to write audit log', { error: String(e) });
    }

    logger.info('[seed-mocks] completed', { createdCount: res.created.length });
    return { createdCount: res.created.length };
  } catch (err) {
    logger.error('[seed-mocks] failed', { error: String(err) });
    throw err;
  }
}
