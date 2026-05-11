/**
 * FILE OBJECTIVE:
 * - Trigger topic-level hydration jobs when content is missing.
 * - Enqueue notes, a single questions job, and tests without blocking the caller.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/session/contentHydrationTrigger.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | collapse questions hydration fan-out to one job because the worker already handles all difficulty levels
 */

import { logger } from '@/lib/logger';
import {
  enqueueNotesHydration,
  enqueueQuestionsHydration,
  enqueueTestsHydration,
} from '@/lib/execution-pipeline/enqueueTopicHydration';

/**
 * Trigger full topic hydration (notes, questions, tests).
 * Fire-and-forget: runs in background, does not block.
 * Logs the hydration request.
 *
 * @param topicId - The topic to hydrate.
 * @param triggerReason - Optional reason for observability (e.g. 'session_start_missing').
 */
export function triggerForTopic(
  topicId: string,
  triggerReason = 'session_start_missing',
): void {
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

      // Questions (en, single job). The worker already generates easy/medium/hard variants.
      const qRes = await enqueueQuestionsHydration({
        topicId,
        language: 'en',
        difficulty: 'medium',
      });
      results.push({
        type: 'questions',
        created: qRes.created,
        jobId: qRes.created ? qRes.jobId : undefined,
        reason: qRes.created === false ? qRes.reason : undefined,
      });

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
