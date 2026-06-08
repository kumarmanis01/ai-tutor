/**
 * FILE OBJECTIVE:
 * - BullMQ Queue factory for recommendation signal events
 *   (IMPRESSION, CLICK, DISMISS). Shares the existing Redis singleton.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial: recommendation-signals queue
 */

import { Queue } from 'bullmq';
import { getSharedConnection } from '@/lib/redis';
import { RECOMMENDATION_SIGNAL_QUEUE } from '@/lib/queues/constants';

export type RecommendationSignalJobData = {
  userId: string;
  recommendationId: string;
  type: 'IMPRESSION' | 'CLICK' | 'DISMISS';
  metadata?: Record<string, unknown>;
};

let _queue: Queue | null = null;

export function getRecommendationSignalQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(RECOMMENDATION_SIGNAL_QUEUE, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 200,
        removeOnFail: 50,
      },
    });
  }
  return _queue;
}
