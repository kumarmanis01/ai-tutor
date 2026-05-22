/**
 * Session domain event listeners (COUPLING-01).
 *
 * TopicRanker subscribes to SESSION_COMPLETED and invalidates its cache.
 * Engagement service records completion for daily habit (points, streak); idempotent by sessionId.
 * Parent and student notifications are sent (fire-and-forget) for every completed session.
 */

import { onSessionCompleted, type SessionCompletedPayload } from './domainEvents';
import { invalidateTopicRankerCache } from '@/lib/recommendations/topicRanker';
import { recordSessionCompletion } from '@/lib/engagement/engagementService';
import { cacheDel } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { notifyParent, DEFAULT_DASHBOARD_URL } from '@/lib/notifications/parentNotify';
import { notifyStudentOnSessionComplete } from '@/lib/notifications/studentNotify';
import { PARENT_NOTIF_EVENTS } from '@/lib/constants/mail';
import { prisma } from '@/lib/prisma';

const dashCacheKey = (userId: string) => `dash:v1:${userId}`;

onSessionCompleted((payload) => {
  invalidateTopicRankerCache(payload.studentId).catch((err) =>
    logger.warn('[SESSION_EVENT] TopicRanker cache invalidation failed', {
      studentId: payload.studentId,
      error: err,
    }),
  );
  cacheDel(dashCacheKey(payload.studentId)).catch((err) =>
    logger.warn('[SESSION_EVENT] Dashboard cache bust failed', {
      studentId: payload.studentId,
      error: err,
    }),
  );
  recordSessionCompletion(payload.studentId, payload.sessionId).catch((err) =>
    logger.warn('[SESSION_EVENT] Engagement recordSessionCompletion failed', {
      studentId: payload.studentId,
      sessionId: payload.sessionId,
      error: err,
    }),
  );
  notifyOnSessionComplete(payload).catch((err) =>
    logger.warn('[SESSION_EVENT] Session-complete notifications failed', {
      studentId: payload.studentId,
      sessionId: payload.sessionId,
      error: err,
    }),
  );
});

async function notifyOnSessionComplete(payload: SessionCompletedPayload): Promise<void> {
  const { studentId, sessionId, xpAwarded, accuracy, masteryDelta, masteryAfter, leveledUp, newLevel } = payload;

  const [session, student] = await Promise.all([
    prisma.structuredSession.findUnique({
      where: { id: sessionId },
      select: {
        startedAt: true,
        completedAt: true,
        topic: {
          select: {
            name: true,
            chapter: {
              select: { subject: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: studentId },
      select: { totalXp: true, currentStreak: true },
    }),
  ]);

  const topicName = session?.topic?.name ?? 'a topic';
  const subjectName = session?.topic?.chapter?.subject?.name ?? 'your subject';
  const sessionDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const endTime = session?.completedAt ?? new Date();
  const sessionDurationMinutes = session?.startedAt
    ? Math.max(1, Math.round((endTime.getTime() - session.startedAt.getTime()) / 60_000))
    : 0;

  await Promise.all([
    notifyParent(studentId, {
      event: PARENT_NOTIF_EVENTS.SESSION_COMPLETE,
      data: {
        topicName,
        subjectName,
        sessionDate,
        dashboardUrl: DEFAULT_DASHBOARD_URL,
      },
    }),
    notifyStudentOnSessionComplete(studentId, {
      xpEarned: xpAwarded,
      totalXp: student?.totalXp ?? 0,
      currentStreak: student?.currentStreak ?? 0,
      conceptName: topicName,
      masteryDelta,
      masteryAfter,
      accuracy,
      badgeNames: [],
      sessionDurationMinutes,
      leveledUp,
      newLevel,
    }),
  ]);
}
