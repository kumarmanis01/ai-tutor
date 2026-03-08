/**
 * FILE OBJECTIVE:
 * - Resolve the target question difficulty from a student's mastery score.
 * - Single source of truth for all Phase 5 adaptive difficulty decisions.
 * - Used by resolvePractice() and resolveTest() in getPhaseContent.ts,
 *   and surfaces into prompt builders via PracticeInputContract.difficulty.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/adaptiveDifficulty.spec.ts
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | Phase 5: created for adaptive difficulty (Spinzy upgrade)
 */

import type { Difficulty } from '@/lib/ai/prompts/schemas';

// Re-export so callers only need to import from this module.
export type { Difficulty };

/**
 * Thresholds that map a mastery (accuracy) score to a question difficulty.
 *
 *   accuracy < 0.50            → 'easy'   (student is still building foundations)
 *   0.50 <= accuracy < 0.75   → 'medium'  (student understands basics, needs application)
 *   accuracy >= 0.75           → 'hard'   (student is ready for deep/applied problems)
 *   null                       → 'medium'  (no signal yet — safe default)
 *
 * Boundaries are half-open intervals [min, max) so 0.50 → medium, 0.75 → hard.
 */
const EASY_CEILING = 0.50;
const MEDIUM_CEILING = 0.75;

/**
 * Maps a student's mastery score to the appropriate question difficulty.
 *
 * @param accuracy - StudentTopicProgress.mastery in [0, 1], or null when no
 *   progress record exists yet (first visit). Null always resolves to 'medium'
 *   so new students receive a representative starting experience.
 * @returns 'easy' | 'medium' | 'hard'
 */
export function resolveTargetDifficulty(accuracy: number | null): Difficulty {
  if (accuracy === null) return 'medium';
  if (accuracy < EASY_CEILING) return 'easy';
  if (accuracy < MEDIUM_CEILING) return 'medium';
  return 'hard';
}
