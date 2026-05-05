/**
 * Session domain event listeners (COUPLING-01).
 *
 * TopicRanker subscribes to SESSION_COMPLETED and invalidates its cache.
 * Engagement service records completion for daily habit (points, streak); idempotent by sessionId.
 * Parent notification is sent (fire-and-forget) for every completed session.
 */

import { onSessionCompleted } from './domainEvents';
import { invalidateTopicRankerCache } from '@/lib/recommendations/topicRanker';
import { recordSessionCompletion } from '@/lib/engagement/engagementService';
import { logger } from '@/lib/logger';
import { notifyParent, DEFAULT_DASHBOARD_URL } from '@/lib/notifications/parentNotify';
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
  notifyParentOnSessionComplete(payload.studentId, payload.sessionId).catch((err) =>
    logger.warn('[SESSION_EVENT] Parent session-complete notification failed', {
      studentId: payload.studentId,
      sessionId: payload.sessionId,
      error: err,
    }),
  );
});

async function notifyParentOnSessionComplete(studentId: string, sessionId: string): Promise<void> {
  const session = await prisma.structuredSession.findUnique({
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
  });

  const topicName = session?.topic?.name ?? 'a topic';
  const subjectName = session?.topic?.chapter?.subject?.name ?? 'your subject';
  const sessionDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  await notifyParent(studentId, {
    event: PARENT_NOTIF_EVENTS.SESSION_COMPLETE,
    data: {
      topicName,
      subjectName,
      sessionDate,
      dashboardUrl: DEFAULT_DASHBOARD_URL,
    },
  });
}
