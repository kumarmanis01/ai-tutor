/**
 * Centralized service for all StudentTopicProgress mutations.
 *
 * EVERY system that updates topic mastery, practice count, or lastStudiedAt
 * MUST go through this module. Do not upsert StudentTopicProgress directly.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type ActivityType = 'PRACTICE' | 'TEST' | 'HOMEWORK' | 'STUDY';

export interface UpdateTopicProgressInput {
  studentId: string;
  topicId: string;
  correctAnswers: number;
  totalAnswers: number;
  activityType: ActivityType;
}

const PROGRESS_WEIGHTS: Record<ActivityType, number> = {
  HOMEWORK: 0.2,
  PRACTICE: 0.1,
  TEST: 0.3,
  STUDY: 0,
};

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Update mastery, practiceCount, and lastStudiedAt for a student-topic pair.
 *
 * - `activityType = "STUDY"` with `totalAnswers = 0` is a touch-only update
 *   (only refreshes lastStudiedAt without changing mastery).
 */
export async function updateStudentTopicProgress(
  input: UpdateTopicProgressInput,
): Promise<void> {
  const { studentId, topicId, correctAnswers, totalAnswers, activityType } = input;

  if (!topicId) return;

  const accuracy = totalAnswers > 0 ? correctAnswers / totalAnswers : 0;
  const weight = PROGRESS_WEIGHTS[activityType] ?? 0;
  const progressDelta = accuracy * weight;

  const existing = await prisma.studentTopicProgress.findUnique({
    where: { studentId_topicId: { studentId, topicId } },
  });

  const prevMastery = existing?.mastery ?? 0;
  const newMastery = clamp(0, 1, prevMastery + progressDelta);
  const newPracticeCount = (existing?.practiceCount ?? 0) + totalAnswers;

  await prisma.studentTopicProgress.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    update: {
      mastery: newMastery,
      practiceCount: newPracticeCount,
      lastStudiedAt: new Date(),
    },
    create: {
      studentId,
      topicId,
      mastery: newMastery,
      practiceCount: newPracticeCount,
      lastStudiedAt: new Date(),
    },
  });

  logger.info('[TOPIC_PROGRESS_UPDATED]', {
    studentId,
    topicId,
    activityType,
    accuracy: totalAnswers > 0 ? +(accuracy.toFixed(3)) : null,
    progressDelta: +(progressDelta.toFixed(4)),
    prevMastery: +(prevMastery.toFixed(3)),
    newMastery: +(newMastery.toFixed(3)),
    practiceCount: newPracticeCount,
  });
}
