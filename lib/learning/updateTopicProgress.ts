/**
 * Centralized service for all StudentTopicProgress mutations.
 *
 * EVERY system that updates topic mastery, practice count, or lastStudiedAt
 * MUST go through this module. Do not upsert StudentTopicProgress directly.
 *
 * Concurrency safety (RISK-02):
 *   Uses atomic SQL (INSERT ... ON CONFLICT DO UPDATE) with
 *   mastery = LEAST(1, GREATEST(0, mastery + delta)). No read-modify-write
 *   race — two concurrent updates both apply correctly.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

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

/**
 * Update mastery, practiceCount, and lastStudiedAt for a student-topic pair.
 *
 * Uses atomic SQL to prevent lost updates when two concurrent requests
 * update the same student-topic row. mastery is clamped to [0, 1].
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

  const initialMastery = Math.max(0, Math.min(1, progressDelta));
  const id = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO "StudentTopicProgress" ("id", "studentId", "topicId", "mastery", "practiceCount", "lastStudiedAt", "updatedAt")
        VALUES (${id}, ${studentId}, ${topicId}, ${initialMastery}, ${totalAnswers}, NOW(), NOW())
        ON CONFLICT ("studentId", "topicId")
        DO UPDATE SET
          "mastery" = LEAST(1, GREATEST(0, "StudentTopicProgress"."mastery" + ${progressDelta})),
          "practiceCount" = "StudentTopicProgress"."practiceCount" + ${totalAnswers},
          "lastStudiedAt" = NOW(),
          "updatedAt" = NOW()
      `,
    );
  });

  const updated = await prisma.studentTopicProgress.findUnique({
    where: { studentId_topicId: { studentId, topicId } },
    select: { mastery: true, practiceCount: true },
  });

  logger.info('[TOPIC_PROGRESS_UPDATED]', {
    studentId,
    topicId,
    activityType,
    accuracy: totalAnswers > 0 ? +(accuracy.toFixed(3)) : null,
    progressDelta: +(progressDelta.toFixed(4)),
    newMastery: updated ? +(updated.mastery.toFixed(3)) : null,
    practiceCount: updated?.practiceCount ?? null,
  });
}
