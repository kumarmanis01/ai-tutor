/**
 * ContentReadinessService (ABSTRACTION-01)
 *
 * Determines whether a topic has sufficient content for a structured learning session.
 *
 * Checks:
 *   - TopicNote exists (lifecycle: active)
 *   - Practice questions exist (Question with topicId)
 *   - Test questions exist (GeneratedTest with topicId that has GeneratedQuestion children)
 *
 * Return:
 *   READY   — all three content types exist
 *   PARTIAL — at least one exists but not all
 *   MISSING — none exist
 *
 * SessionEngine calls this before startSession() to gate session creation.
 */

import { prisma } from '@/lib/prisma';

export type ContentReadiness = 'READY' | 'PARTIAL' | 'MISSING';

export interface ContentReadinessResult {
  /** READY | PARTIAL | MISSING */
  status: ContentReadiness;
  hasNotes: boolean;
  hasPracticeQuestions: boolean;
  hasTestQuestions: boolean;
}

/**
 * Check whether a topic has sufficient content for a learning session.
 *
 * @param topicId - The topic to check.
 * @returns ContentReadinessResult with readiness level and per-content flags.
 */
async function isTopicReady(topicId: string): Promise<ContentReadinessResult> {
  const [hasNotes, hasPracticeQuestions, hasTestQuestions] = await Promise.all([
    prisma.topicNote
      .count({ where: { topicId, lifecycle: 'active' } })
      .then((n) => n > 0),
    prisma.question
      .count({ where: { topicId } })
      .then((n) => n > 0),
    prisma.generatedQuestion
      .count({ where: { test: { topicId, lifecycle: 'active' } } })
      .then((n) => n > 0),
  ]);

  const count = [hasNotes, hasPracticeQuestions, hasTestQuestions].filter(Boolean).length;
  const readiness: ContentReadiness =
    count === 3 ? 'READY' : count > 0 ? 'PARTIAL' : 'MISSING';

  return {
    status: readiness,
    hasNotes,
    hasPracticeQuestions,
    hasTestQuestions,
  };
}

/** ABSTRACTION-01: Content readiness service for session gating. */
export const contentReadinessService = { isTopicReady };
