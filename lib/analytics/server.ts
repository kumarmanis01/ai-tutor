/**
 * FILE OBJECTIVE:
 * - Shared server-side analytics emitter for API routes and server workflows.
 * - Enqueues analytics jobs when Redis is available and falls back to direct AnalyticsEvent writes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/analytics/server.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | create shared best-effort server analytics emitter for API routes
 */

import { Prisma } from '@prisma/client';
import { type AnalyticsEventName } from '@/lib/analytics/events';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getAnalyticsQueue } from '@/lib/queues/analyticsQueue';

export interface ServerAnalyticsEventInput {
  eventType: AnalyticsEventName | string;
  userId?: string | null;
  courseId?: string | null;
  lessonIdx?: number | null;
  metadata?: Prisma.InputJsonValue;
}

export async function emitServerAnalyticsEvent(
  event: ServerAnalyticsEventInput,
  source: string,
): Promise<void> {
  const payload = {
    eventType: event.eventType,
    userId: event.userId ?? null,
    courseId: event.courseId ?? null,
    lessonIdx: typeof event.lessonIdx === 'number' ? event.lessonIdx : null,
    metadata: event.metadata ?? {},
  };

  try {
    const analyticsQueue = getAnalyticsQueue();
    if (analyticsQueue) {
      try {
        await analyticsQueue.add('analytics.ingest', payload);
        return;
      } catch (enqueueErr) {
        logger.warn('analytics.server.enqueue_failed', {
          source,
          eventType: payload.eventType,
          error: String(enqueueErr),
        });
      }
    }

    await prisma.analyticsEvent.create({ data: payload });
  } catch (err) {
    logger.warn('analytics.server.emit_failed', {
      source,
      eventType: payload.eventType,
      error: String(err),
    });
  }
}

const analyticsServer = {
  emitServerAnalyticsEvent,
};

export default analyticsServer