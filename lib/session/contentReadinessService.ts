/**
 * FILE OBJECTIVE:
 * - ContentReadinessService: Determines if a topic has sufficient content for a session (notes, practice, test questions).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/session/contentReadinessService.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-23T00:00:00Z | copilot | strict-mode: add local row types, file header
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
  // All Prisma .count() calls return number, so no local row types needed for those.
  const [hasNotes, hasPracticeQuestions, hasTestQuestions] = await Promise.all([
    prisma.topicNote.count({ where: { topicId, lifecycle: 'active' } }).then((n: number) => n > 0),
    prisma.question.count({ where: { topicId } }).then((n: number) => n > 0),
    prisma.generatedQuestion
      .count({ where: { test: { topicId, lifecycle: 'active' } } })
      .then((n: number) => n > 0),
  ]);

  const count = [hasNotes, hasPracticeQuestions, hasTestQuestions].filter(Boolean).length;
  const readiness: ContentReadiness = count === 3 ? 'READY' : count > 0 ? 'PARTIAL' : 'MISSING';

  return {
    status: readiness,
    hasNotes,
    hasPracticeQuestions,
    hasTestQuestions,
  };
}

/** ABSTRACTION-01: Content readiness service for session gating. */
export const contentReadinessService = { isTopicReady };
