/**
 * Session domain event listeners (COUPLING-01).
 *
 * TopicRanker subscribes to SESSION_COMPLETED and invalidates its cache.
 * Engagement service records completion for daily habit (points, streak); idempotent by sessionId.
 * Parent and student notifications are sent (fire-and-forget) for every completed session.
 */

import { onSessionCompleted } from './domainEvents';
import { invalidateTopicRankerCache } from '@/lib/recommendations/topicRanker';
import { recordSessionCompletion } from '@/lib/engagement/engagementService';
import { logger } from '@/lib/logger';
import { notifyParent, DEFAULT_DASHBOARD_URL } from '@/lib/notifications/parentNotify';
import { notifyStudentOnSessionComplete } from '@/lib/notifications/studentNotify';
import { PARENT_NOTIF_EVENTS } from '@/lib/constants/mail';
import { prisma } from '@/lib/prisma';

onSessionCompleted((payload) => {
  invalidateTopicRankerCache(payload.studentId).catch((err) =>
    logger.warn('[SESSION_EVENT] TopicRanker cache invalidation failed', {
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
  notifyOnSessionComplete(payload.studentId, payload.sessionId).catch((err) =>
    logger.warn('[SESSION_EVENT] Session-complete notifications failed', {
      studentId: payload.studentId,
      sessionId: payload.sessionId,
      error: err,
    }),
  );
});

async function notifyOnSessionComplete(studentId: string, sessionId: string): Promise<void> {
  const [session, student] = await Promise.all([
    prisma.structuredSession.findUnique({
      where: { id: sessionId },
      select: {
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
      xpEarned: 0,
      totalXp: student?.totalXp ?? 0,
      currentStreak: student?.currentStreak ?? 0,
      conceptName: topicName,
      masteryDelta: 0,
      masteryAfter: 0,
      accuracy: 0,
      badgeNames: [],
      sessionDurationMinutes: 0,
      leveledUp: false,
      newLevel: null,
    }),
  ]);
}
