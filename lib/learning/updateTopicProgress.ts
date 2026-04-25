/**
 * Centralized service for all StudentTopicProgress mutations.
 *
 * EVERY system that updates topic mastery, practice count, or lastStudiedAt
 * MUST go through this module. Do not upsert StudentTopicProgress directly.
 *
 * Concurrency safety (RISK-02):
 *   Uses atomic SQL (INSERT ... ON CONFLICT DO UPDATE) with
 *   mastery = LEAST(1, GREATEST(0, mastery + delta)). No read-modify-write
 *   race -- two concurrent updates both apply correctly.
 *
 * Dual-write (Phase 3):
 *   Both StudentTopicProgress and StudentTopicMastery are updated inside a
 *   single Prisma transaction to keep them consistent.
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

/** Derives a MasteryLevel string from an accuracy value. */
function computeMasteryLevel(
  accuracy: number
): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (accuracy >= 0.9) return 'expert';
  if (accuracy >= 0.75) return 'advanced';
  if (accuracy >= 0.6) return 'intermediate';
  return 'beginner';
}

/**
 * Update mastery, practiceCount, and lastStudiedAt for a student-topic pair.
 *
 * Uses atomic SQL to prevent lost updates when two concurrent requests
 * update the same student-topic row. mastery is clamped to [0, 1].
 *
 * - `activityType = "STUDY"` with `totalAnswers = 0` is a touch-only update
 *   (only refreshes lastStudiedAt without changing mastery).
 */
export async function updateStudentTopicProgress(input: UpdateTopicProgressInput): Promise<void> {
  const { studentId, topicId, correctAnswers, totalAnswers, activityType } = input;

  if (!topicId) return;

  const accuracy = totalAnswers > 0 ? correctAnswers / totalAnswers : 0;
  const weight = PROGRESS_WEIGHTS[activityType] ?? 0;
  const progressDelta = accuracy * weight;

  const initialMastery = Math.max(0, Math.min(1, progressDelta));
  const progressId = randomUUID();
  const masteryId = randomUUID();
  const now = new Date();

  // Fetch topic metadata needed for StudentTopicMastery subject/chapter on INSERT.
  // One extra query per call; acceptable given the dual-write requirement.
  const topicDef = await prisma.topicDef.findUnique({
    where: { id: topicId },
    select: {
      chapter: {
        select: { name: true, subject: { select: { name: true } } },
      },
    },
  });
  const chapterName = topicDef?.chapter.name ?? '';
  const subjectName = topicDef?.chapter.subject.name ?? '';
  const masteryLevel = computeMasteryLevel(accuracy);

  // Single transaction: StudentTopicProgress (atomic SQL) + StudentTopicMastery (upsert).
  await prisma.$transaction(async (tx) => {
    // 1. Atomic upsert on StudentTopicProgress -- preserves concurrent-update safety.
    // Prisma.sql may not be available in some test/mock environments
    // Guard access and fall back to a simple raw SQL string so unit tests
    // that mock `tx.$executeRaw` do not throw at template-tag resolution time.
    const rawSql =
      Prisma && typeof (Prisma as any).sql === 'function'
        ? Prisma.sql`
        INSERT INTO "StudentTopicProgress" ("id", "studentId", "topicId", "mastery", "practiceCount", "lastStudiedAt", "updatedAt")
        VALUES (${progressId}, ${studentId}, ${topicId}, ${initialMastery}, ${totalAnswers}, NOW(), NOW())
        ON CONFLICT ("studentId", "topicId")
        DO UPDATE SET
          "mastery" = LEAST(1, GREATEST(0, "StudentTopicProgress"."mastery" + ${progressDelta})),
          "practiceCount" = "StudentTopicProgress"."practiceCount" + ${totalAnswers},
          "lastStudiedAt" = NOW(),
          "updatedAt" = NOW()
      `
        : `INSERT INTO "StudentTopicProgress" ("id", "studentId", "topicId", "mastery", "practiceCount", "lastStudiedAt", "updatedAt") VALUES ('${progressId}', '${studentId}', '${topicId}', ${initialMastery}, ${totalAnswers}, NOW(), NOW()) ON CONFLICT ("studentId", "topicId") DO UPDATE SET "mastery" = LEAST(1, GREATEST(0, "StudentTopicProgress"."mastery" + ${progressDelta})), "practiceCount" = "StudentTopicProgress"."practiceCount" + ${totalAnswers}, "lastStudiedAt" = NOW(), "updatedAt" = NOW()`;

    await tx.$executeRaw(rawSql as any);

    // 2. Upsert StudentTopicMastery -- keeps mastery table consistent with progress.
    //    accuracy reflects this session's performance; questionsAttempted accumulates.
    await tx.studentTopicMastery.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      create: {
        id: masteryId,
        studentId,
        topicId,
        subject: subjectName,
        chapter: chapterName,
        masteryLevel,
        accuracy,
        questionsAttempted: totalAnswers,
        lastAttemptedAt: now,
      },
      update: {
        accuracy,
        masteryLevel,
        questionsAttempted: { increment: totalAnswers },
        lastAttemptedAt: now,
      },
    });
  });

  const updated = await prisma.studentTopicProgress.findUnique({
    where: { studentId_topicId: { studentId, topicId } },
    select: { mastery: true, practiceCount: true },
  });

  logger.info('[TOPIC_PROGRESS_UPDATED]', {
    studentId,
    topicId,
    activityType,
    accuracy: totalAnswers > 0 ? +accuracy.toFixed(3) : null,
    progressDelta: +progressDelta.toFixed(4),
    newMastery: updated ? +updated.mastery.toFixed(3) : null,
    practiceCount: updated?.practiceCount ?? null,
  });
}
