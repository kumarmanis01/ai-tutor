/**
 * FILE OBJECTIVE:
 * - Handles lesson/action completion from the NextActionCard CTA.
 * - Marks the LearningSession as complete (if sessionId provided).
 * - Ensures a StudentTopicMastery record exists for the topic WITHOUT
 *   inflating accuracy — accuracy is owned exclusively by the practice
 *   grading pipeline (updateTopicMastery in lib/tests.ts).
 * - Returns the next recommended action so the UI can update in-place.
 *
 * This is the bridge that closes the Notes → Practice loop:
 *   complete lesson → mastery record exists with accuracy 0 →
 *   next-action P4 fires (accuracy < 0.6) → practice recommended.
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | created to wire NextActionCard completion into mastery loop
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/home/complete-action
 * Body: { topicId?, subject?, chapter?, sessionId? }
 *
 * Called by NextActionCard when the student clicks the primary CTA
 * (e.g. "Start Lesson", "Continue Lesson") and marks it done.
 */
export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { topicId, subject, chapter, sessionId } = (body ?? {}) as {
    topicId?: string;
    subject?: string;
    chapter?: string;
    sessionId?: string;
  };

  await prisma.$transaction(async (tx) => {
    // 1. Mark LearningSession complete when resuming an existing session.
    //    Compute actualTimeSpent from server timestamps (startedAt → now).
    if (sessionId) {
      const ls = await tx.learningSession.findFirst({
        where: { id: sessionId, studentId: userId },
        select: { id: true, isCompleted: true, startedAt: true, endedAt: true },
      });
      if (ls) {
        if (ls.endedAt) {
          // Session already finalized — do not overwrite endedAt or actualTimeSpent.
          logger.info('session.completed', { sessionId, minutesWritten: 0, idempotent: true });
        } else if (!ls.isCompleted) {
          const now = new Date();
          const elapsedMinutes = Math.max(1, Math.floor((now.getTime() - ls.startedAt.getTime()) / 60000));
          await tx.learningSession.update({
            where: { id: ls.id },
            data: {
              isCompleted: true,
              completionPercentage: 100,
              lastAccessed: now,
              endedAt: now,
              actualTimeSpent: elapsedMinutes,
            },
          });
          logger.info('session.completed', { sessionId, minutesWritten: elapsedMinutes, idempotent: false });
        }
      }
    }

    // 2. Ensure a StudentTopicMastery record exists so HomeEngine P4 can
    //    detect the topic as needing practice (accuracy 0 < 0.6).
    //    On UPDATE we only touch the timestamp — never accuracy or masteryLevel.
    if (topicId) {
      await tx.studentTopicMastery.upsert({
        where: { studentId_topicId: { studentId: userId, topicId } },
        update: { lastAttemptedAt: new Date() },
        create: {
          studentId: userId,
          topicId,
          subject: subject ?? '',
          chapter: chapter ?? '',
          masteryLevel: 'beginner',
          accuracy: 0,
          questionsAttempted: 0,
          lastAttemptedAt: new Date(),
        },
      });
    }
  });

  // 3. Compute the next recommended action — reflects updated mastery state.
  const nextAction = await getNextAction(userId);

  logger.info('lesson.completed.transition', {
    studentId: userId,
    topicId,
    nextRule: nextAction?.ruleId ?? null,
  });

  return NextResponse.json({ nextAction });
}
