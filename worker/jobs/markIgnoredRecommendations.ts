/**
 * FILE OBJECTIVE:
 * - Background job to mark recommendations as ignored if shown but never clicked after 7 days
 * - Runs daily to maintain engagement tracking accuracy
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/jobs/markIgnoredRecommendations.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-01 | claude | created background job for ignored recommendation tracking
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Mark recommendations as ignored if shown >7 days ago but never clicked
 * This helps the recommendation engine learn which content types users ignore
 *
 * @returns Number of recommendations marked as ignored
 */
export async function markIgnoredRecommendations(): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.contentRecommendation.updateMany({
      where: {
        isShown: true,
        isClicked: false,
        isIgnored: false,
        firstShownAt: { lt: sevenDaysAgo },
      },
      data: {
        isIgnored: true,
        ignoredAt: new Date(),
      }
    });

    logger.info('markIgnoredRecommendations.completed', {
      count: updated.count,
      threshold: sevenDaysAgo.toISOString()
    });

    return updated.count;
  } catch (error) {
    logger.error('markIgnoredRecommendations.error', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Cleanup old ignored recommendations (>90 days) to keep table size manageable
 * Optional maintenance task
 *
 * @returns Number of recommendations deleted
 */
export async function cleanupOldIgnoredRecommendations(): Promise<number> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const deleted = await prisma.contentRecommendation.deleteMany({
      where: {
        isIgnored: true,
        ignoredAt: { lt: ninetyDaysAgo },
        isCompleted: false, // Keep completed ones for analytics
      }
    });

    logger.info('cleanupOldIgnoredRecommendations.completed', {
      count: deleted.count,
      threshold: ninetyDaysAgo.toISOString()
    });

    return deleted.count;
  } catch (error) {
    logger.error('cleanupOldIgnoredRecommendations.error', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export default markIgnoredRecommendations;
