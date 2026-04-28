/**
 * Learning Momentum Score
 *
 * Measures a student's current engagement intensity on a 0-1 scale.
 * Used as a boost signal in the topic ranker.
 *
 * Formula:
 *   momentum = (sessionFrequency * 0.4)
 *            + (homeworkCompletionRate * 0.4)
 *            + (practiceIntensity * 0.2)
 *
 * Each component is independently clamped to [0, 1].
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SESSION_CAP = 14;
const PRACTICE_CAP = 50;

export interface MomentumResult {
  score: number;
  sessionFrequency: number;
  homeworkCompletionRate: number;
  practiceIntensity: number;
}

/**
 * Compute the learning momentum score for a student.
 *
 * - `sessionFrequency`:      sessions in last 7 days / SESSION_CAP (14)
 * - `homeworkCompletionRate`: (GRADED + SUBMITTED) / total homework assigned
 * - `practiceIntensity`:     total practiceCount across all topics / PRACTICE_CAP (50)
 */
export async function computeMomentumScore(studentId: string): Promise<MomentumResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [sessionsLast7, homeworkStats, practiceAgg] = await Promise.all([
    prisma.learningSession.count({
      where: { studentId, startedAt: { gte: sevenDaysAgo } },
    }),

    prisma.homeworkAssignment.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { id: true },
    }),

    prisma.studentTopicProgress.aggregate({
      where: { studentId },
      _sum: { practiceCount: true },
    }),
  ]);

  const sessionFrequency = clamp(sessionsLast7 / SESSION_CAP);

  let totalHomework = 0;
  let completedHomework = 0;
  for (const g of homeworkStats) {
    const count = g._count.id;
    totalHomework += count;
    if (g.status === 'GRADED' || g.status === 'SUBMITTED') {
      completedHomework += count;
    }
  }
  const homeworkCompletionRate = totalHomework > 0 ? clamp(completedHomework / totalHomework) : 0;

  const totalPractice = practiceAgg._sum.practiceCount ?? 0;
  const practiceIntensity = clamp(totalPractice / PRACTICE_CAP);

  const score = clamp(
    sessionFrequency * 0.4 + homeworkCompletionRate * 0.4 + practiceIntensity * 0.2
  );

  logger.debug('[MOMENTUM_SCORE]', {
    studentId,
    score: +score.toFixed(3),
    sessionFrequency: +sessionFrequency.toFixed(3),
    homeworkCompletionRate: +homeworkCompletionRate.toFixed(3),
    practiceIntensity: +practiceIntensity.toFixed(3),
    raw: { sessionsLast7, completedHomework, totalHomework, totalPractice },
  });

  return { score, sessionFrequency, homeworkCompletionRate, practiceIntensity };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
