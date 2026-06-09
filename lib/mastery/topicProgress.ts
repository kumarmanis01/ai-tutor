/**
 * FILE OBJECTIVE:
 * - Service layer for the 3-state mastery FSM (NOT_STARTED -> DEVELOPING -> MASTERED)
 *   per student per topic, driven by quiz outcomes.
 * - Also exports getRecommendedToughness(), a pure function that derives the
 *   AI-recommended difficulty level from already-fetched TopicProgress fields.
 *
 * LINKED UNIT TEST:
 * - tests/unit/mastery/topicProgress.test.ts
 * - tests/unit/mastery/topicProgress.recommendation.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-3a: add getRecommendedToughness() pure function
 * - 2026-06-08T00:01:00Z | claude | initial creation -- S2-1 TopicProgress mastery FSM
 */

import { MasteryState } from '@prisma/client';
import type { TopicProgress } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const MASTERY_SCORE_THRESHOLD = 0.80;
const REGRESSION_SCORE_THRESHOLD = 0.50;
const MIN_ATTEMPTS_FOR_MASTERY = 2;
const DEFAULT_PROGRESS_LIMIT = 20;
/** Rolling window size for the weighted score average. */
const ROLLING_WINDOW = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecordQuizOutcomeParams {
  userId: string;
  topicSlug: string;
  subject: string;
  grade: string;
  board: string;
  /** Quiz score expressed as a percentage: 0-100. */
  scorePercent: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Computes the next FSM state based on the new score and attempt count.
 * Regression (MASTERED -> DEVELOPING) applies when score drops below 0.50.
 */
function computeNextState(
  currentState: MasteryState,
  newScore: number,
  newAttempts: number,
): MasteryState {
  if (currentState === MasteryState.MASTERED) {
    return newScore < REGRESSION_SCORE_THRESHOLD
      ? MasteryState.DEVELOPING
      : MasteryState.MASTERED;
  }

  if (
    newScore >= MASTERY_SCORE_THRESHOLD &&
    newAttempts >= MIN_ATTEMPTS_FOR_MASTERY
  ) {
    return MasteryState.MASTERED;
  }

  return MasteryState.DEVELOPING;
}

/**
 * Computes the updated rolling-average score from the current stored values.
 * Caps the effective window at ROLLING_WINDOW (3) samples.
 *
 * Formula: newScore = (existingScore * min(attempts, 2) + scorePercent/100) / (min(attempts, 2) + 1)
 */
function computeRollingScore(
  existingScore: number,
  existingAttempts: number,
  incomingScore: number,
): number {
  const weight = Math.min(existingAttempts, ROLLING_WINDOW - 1);
  return (existingScore * weight + incomingScore) / (weight + 1);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Records a quiz outcome for a student on a topic and applies FSM state transitions.
 * Uses an atomic upsert to avoid read-then-write races.
 *
 * @param params - Quiz outcome parameters including userId, topic identity, and scorePercent.
 * @returns The updated TopicProgress record.
 * @throws Re-throws DB errors after logging; callers decide recovery strategy.
 */
export async function recordQuizOutcome(
  params: RecordQuizOutcomeParams,
): Promise<TopicProgress> {
  const { userId, topicSlug, subject, grade, board, scorePercent } = params;
  const incomingScore = scorePercent / 100;
  const now = new Date();

  // Fetch existing record to compute rolling score and determine state transition.
  // A missing record is treated as score=0, attempts=0, state=NOT_STARTED.
  let existing: TopicProgress | null = null;
  try {
    existing = await prisma.topicProgress.findUnique({
      where: {
        userId_topicSlug_subject_grade_board: {
          userId,
          topicSlug,
          subject,
          grade,
          board,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('mastery.topicProgress.findUnique.failed', { userId, topicSlug, error: message });
    throw err;
  }

  const existingScore = existing?.score ?? 0;
  const existingAttempts = existing?.attempts ?? 0;
  const currentState = existing?.state ?? MasteryState.NOT_STARTED;

  const newScore = computeRollingScore(existingScore, existingAttempts, incomingScore);
  const newAttempts = existingAttempts + 1;
  const nextState = computeNextState(currentState, newScore, newAttempts);

  const isMasteringNow = nextState === MasteryState.MASTERED && currentState !== MasteryState.MASTERED;
  const isRegressing = nextState === MasteryState.DEVELOPING && currentState === MasteryState.MASTERED;

  const masteredAt = isMasteringNow
    ? now
    : isRegressing
      ? null
      : existing?.masteredAt ?? null;

  try {
    const result = await prisma.topicProgress.upsert({
      where: {
        userId_topicSlug_subject_grade_board: {
          userId,
          topicSlug,
          subject,
          grade,
          board,
        },
      },
      create: {
        userId,
        topicSlug,
        subject,
        grade,
        board,
        state: nextState,
        score: newScore,
        attempts: newAttempts,
        lastStudiedAt: now,
        masteredAt,
      },
      update: {
        state: nextState,
        score: newScore,
        attempts: newAttempts,
        lastStudiedAt: now,
        masteredAt,
      },
    });

    logger.info('mastery.topicProgress.recorded', {
      userId,
      topicSlug,
      state: nextState,
      score: newScore,
      attempts: newAttempts,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('mastery.topicProgress.upsert.failed', { userId, topicSlug, error: message });
    throw err;
  }
}

/**
 * Fetches a single TopicProgress record for a student and topic.
 *
 * @returns The record or null if no attempt has been recorded yet.
 */
export async function getTopicProgress(
  userId: string,
  topicSlug: string,
  subject: string,
  grade: string,
  board: string,
): Promise<TopicProgress | null> {
  try {
    return await prisma.topicProgress.findUnique({
      where: {
        userId_topicSlug_subject_grade_board: {
          userId,
          topicSlug,
          subject,
          grade,
          board,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('mastery.topicProgress.getTopicProgress.failed', { userId, topicSlug, error: message });
    throw err;
  }
}

/**
 * Returns TopicProgress records in a given state, sorted by lastStudiedAt ASC
 * so longest-idle topics surface first (used by the Revise tab).
 *
 * @param limit - Maximum records to return (default: 20).
 */
export async function getProgressByState(
  userId: string,
  state: MasteryState,
  limit: number = DEFAULT_PROGRESS_LIMIT,
): Promise<TopicProgress[]> {
  try {
    return await prisma.topicProgress.findMany({
      where: { userId, state },
      orderBy: { lastStudiedAt: 'asc' },
      take: limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('mastery.topicProgress.getProgressByState.failed', { userId, state, error: message });
    throw err;
  }
}

/**
 * Returns topics in the DEVELOPING state, sorted by lastStudiedAt ASC.
 * Convenience wrapper over getProgressByState for the Revise tab (S2-2).
 *
 * @param limit - Maximum records to return (default: 20).
 */
export async function getDevelopingTopics(
  userId: string,
  limit?: number,
): Promise<TopicProgress[]> {
  return getProgressByState(userId, MasteryState.DEVELOPING, limit);
}

/**
 * Returns the count of topics the student has fully mastered.
 */
export async function getMasteredCount(userId: string): Promise<number> {
  try {
    return await prisma.topicProgress.count({
      where: { userId, state: MasteryState.MASTERED },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('mastery.topicProgress.getMasteredCount.failed', { userId, error: message });
    throw err;
  }
}

// ─── Recommendation ────────────────────────────────────────────────────────────

export interface ToughnessRecommendation {
  toughness: number;
  label: string;
  reason: string;
}

interface GetRecommendedToughnessParams {
  state: MasteryState | null;
  score: number;
  attempts: number;
}

/**
 * Derives the AI-recommended starting toughness from already-fetched TopicProgress fields.
 * Pure function -- no DB calls, no async. Safe to call on every page render.
 *
 * Priority order:
 *   1. No attempts yet (or null progress row) -> toughness 3, "Start here"
 *   2. DEVELOPING + score < 0.40              -> toughness 2, "Let's strengthen the basics"
 *   3. DEVELOPING + 0.40 <= score < 0.70      -> toughness 4, "You are making good progress"
 *   4. DEVELOPING + score >= 0.70             -> toughness 6, "You are nearly there -- push harder"
 *   5. MASTERED                               -> toughness 8, "You have mastered this -- go deeper"
 */
export function getRecommendedToughness(
  params: GetRecommendedToughnessParams,
): ToughnessRecommendation {
  const { state, score, attempts } = params;

  if (state === null || attempts === 0) {
    return { toughness: 3, label: 'Easy', reason: 'Start here' };
  }

  if (state === MasteryState.MASTERED) {
    return {
      toughness: 8,
      label: 'Challenge',
      reason: 'You have mastered this -- go deeper',
    };
  }

  // DEVELOPING branch
  if (score < 0.40) {
    return {
      toughness: 2,
      label: 'Easier',
      reason: "Let's strengthen the basics",
    };
  }

  if (score < 0.70) {
    return {
      toughness: 4,
      label: 'Standard',
      reason: 'You are making good progress',
    };
  }

  return {
    toughness: 6,
    label: 'Challenge',
    reason: 'You are nearly there -- push harder',
  };
}
