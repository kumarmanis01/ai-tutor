/**
 * Session Analytics — fire-and-forget event recording for structured sessions.
 *
 * Events are written asynchronously; failures are logged but never
 * propagated so they cannot break the session flow.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

type SessionEventType =
  | 'SESSION_STARTED'
  | 'SESSION_OVERVIEW_VIEWED'
  | 'PHASE_STARTED'
  | 'QUESTION_ANSWERED'
  | 'HOMEWORK_SUBMITTED'
  | 'SESSION_COMPLETED';

export interface SessionEventPayload {
  sessionId: string;
  eventType: SessionEventType;
  metadata?: Record<string, unknown>;
}

/**
 * Record a single session analytics event.
 * Runs fire-and-forget — the returned promise resolves even on failure.
 */
export async function recordSessionEvent(
  payload: SessionEventPayload,
): Promise<void> {
  try {
    await prisma.sessionEvent.create({
      data: {
        sessionId: payload.sessionId,
        eventType: payload.eventType,
        metadata: payload.metadata ?? undefined,
      },
    });

    logger.debug('[SESSION_EVENT]', {
      sessionId: payload.sessionId,
      eventType: payload.eventType,
    });
  } catch (err) {
    logger.warn('[SESSION_EVENT_FAILED]', {
      sessionId: payload.sessionId,
      eventType: payload.eventType,
      error: String(err),
    });
  }
}

/**
 * Convenience: record multiple events in a single transaction.
 */
export async function recordSessionEvents(
  events: SessionEventPayload[],
): Promise<void> {
  try {
    await prisma.$transaction(
      events.map((e) =>
        prisma.sessionEvent.create({
          data: {
            sessionId: e.sessionId,
            eventType: e.eventType,
            metadata: e.metadata ?? undefined,
          },
        }),
      ),
    );
  } catch (err) {
    logger.warn('[SESSION_EVENTS_BATCH_FAILED]', {
      count: events.length,
      error: String(err),
    });
  }
}
