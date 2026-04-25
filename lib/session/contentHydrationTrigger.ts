/**
 * ContentHydrationTrigger (GAP-03)
 *
 * When ContentReadinessService returns MISSING, triggers HydrationJob creation
 * for the topic (notes, practice questions, test assembly).
 *
 * - Fire-and-forget: does not block the caller.
 * - Logs hydration request for observability.
 * - Uses lib/execution-pipeline enqueue functions (idempotent, HydrationJob + Outbox).
 */

import { logger } from '@/lib/logger';
import {
  enqueueNotesHydration,
  enqueueQuestionsHydration,
  enqueueTestsHydration,
} from '@/lib/execution-pipeline/enqueueTopicHydration';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

/**
 * Trigger full topic hydration (notes, questions, tests).
 * Fire-and-forget: runs in background, does not block.
 * Logs the hydration request.
 *
 * @param topicId - The topic to hydrate.
 * @param triggerReason - Optional reason for observability (e.g. 'session_start_missing').
 */
export function triggerForTopic(topicId: string, triggerReason = 'session_start_missing'): void {
  logger.info('[GAP-03] ContentHydrationTrigger: hydration request', {
    topicId,
    triggerReason,
  });

  void (async () => {
    try {
      const results: { type: string; created: boolean; jobId?: string; reason?: string }[] = [];

      // Notes (en)
      const notesRes = await enqueueNotesHydration({ topicId, language: 'en' });
      results.push({
        type: 'notes',
        created: notesRes.created,
        jobId: notesRes.created ? notesRes.jobId : undefined,
        reason: notesRes.created === false ? notesRes.reason : undefined,
      });

      // Questions (en, each difficulty)
      for (const d of DIFFICULTIES) {
        const qRes = await enqueueQuestionsHydration({
          topicId,
          language: 'en',
          difficulty: d,
        });
        results.push({
          type: `questions_${d}`,
          created: qRes.created,
          jobId: qRes.created ? qRes.jobId : undefined,
          reason: qRes.created === false ? qRes.reason : undefined,
        });
      }

      // Tests (en, medium)
      const testsRes = await enqueueTestsHydration({
        topicId,
        language: 'en',
        difficulty: 'medium',
      });
      results.push({
        type: 'tests',
        created: testsRes.created,
        jobId: testsRes.created ? testsRes.jobId : undefined,
        reason: testsRes.created === false ? testsRes.reason : undefined,
      });

      const createdCount = results.filter((r) => r.created).length;
      logger.info('[GAP-03] ContentHydrationTrigger: hydration triggered', {
        topicId,
        triggerReason,
        jobsCreated: createdCount,
        results,
      });
    } catch (err) {
      logger.error('[GAP-03] ContentHydrationTrigger: failed to trigger hydration', {
        topicId,
        triggerReason,
        error: err,
      });
    }
  })();
}

/** GAP-03: Content hydration trigger for session gating. */
export const contentHydrationTrigger = { triggerForTopic };
