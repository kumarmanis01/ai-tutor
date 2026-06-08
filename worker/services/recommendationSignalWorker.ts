/**
 * FILE OBJECTIVE:
 * - BullMQ worker that processes recommendation signal events (IMPRESSION, CLICK, DISMISS).
 *   Persists a RecommendationEvent row and invalidates the Redis cache on CLICK.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial: recommendation signal worker
 */

import type { Job } from 'bullmq';
import { prisma } from '../../lib/prisma.js';
import { getRedis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import type { RecommendationSignalJobData } from '../../queues/recommendationSignalQueue.js';

const CACHE_KEY_PREFIX = 'reco:v1:';

/**
 * Processes a single recommendation signal job.
 * - Upserts a RecommendationEvent row.
 * - On CLICK: deletes the Redis recommendation cache for the user.
 */
export async function processRecommendationSignal(
  job: Job<RecommendationSignalJobData>
): Promise<void> {
  const { userId, recommendationId, type, metadata } = job.data;

  try {
    await prisma.recommendationEvent.create({
      data: {
        userId,
        recommendationId,
        type,
        metadata: metadata ?? undefined,
      },
    });
  } catch (err) {
    logger.error('recommendationSignalWorker.persist.failed', {
      event: 'recommendationSignalWorker.persist.failed',
      context: { userId, recommendationId, type, error: String(err) },
    });
    // Re-throw so BullMQ retries up to the configured max (2)
    throw err;
  }

  // On click: invalidate the recommendation cache so the next GET returns fresh results
  if (type === 'CLICK') {
    try {
      const redis = getRedis();
      if (redis) {
        await redis.del(`${CACHE_KEY_PREFIX}${userId}`);
      }
    } catch (err) {
      // Cache invalidation failure is non-fatal -- log and continue
      logger.warn('recommendationSignalWorker.cache_invalidate.failed', {
        event: 'recommendationSignalWorker.cache_invalidate.failed',
        context: { userId, error: String(err) },
      });
    }
  }

  logger.info('recommendationSignalWorker.processed', {
    event: 'recommendationSignalWorker.processed',
    context: { userId, recommendationId, type },
  });
}
