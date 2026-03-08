/**
 * Session domain event listeners (COUPLING-01).
 *
 * TopicRanker subscribes to SESSION_COMPLETED and invalidates its cache.
 * Engagement service records completion for daily habit (points, streak); idempotent by sessionId.
 */

import { onSessionCompleted } from './domainEvents';
import { invalidateTopicRankerCache } from '@/lib/recommendations/topicRanker';
import { recordSessionCompletion } from '@/lib/engagement/engagementService';
import { logger } from '@/lib/logger';

onSessionCompleted((payload) => {
  invalidateTopicRankerCache(payload.studentId).catch((err) =>
    logger.warn('[SESSION_EVENT] TopicRanker cache invalidation failed', {
      studentId: payload.studentId,
      error: err,
    }),
  );
  recordSessionCompletion(payload.studentId, payload.sessionId).catch((err) =>
    logger.warn('[SESSION_EVENT] Engagement recordSessionCompletion failed', {
      studentId: payload.studentId,
      sessionId: payload.sessionId,
      error: err,
    }),
  );
});
