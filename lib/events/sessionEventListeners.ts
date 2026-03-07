/**
 * Session domain event listeners (COUPLING-01).
 *
 * TopicRanker subscribes to SESSION_COMPLETED and invalidates its cache.
 * This removes the direct SessionEngine → TopicRanker dependency.
 */

import { onSessionCompleted } from './domainEvents';
import { invalidateTopicRankerCache } from '@/lib/recommendations/topicRanker';
import { logger } from '@/lib/logger';

onSessionCompleted((payload) => {
  invalidateTopicRankerCache(payload.studentId).catch((err) =>
    logger.warn('[SESSION_EVENT] TopicRanker cache invalidation failed', {
      studentId: payload.studentId,
      error: err,
    }),
  );
});
