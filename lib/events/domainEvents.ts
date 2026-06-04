/**
 * Domain event bus (COUPLING-01).
 *
 * Decouples producers (e.g. SessionEngine) from consumers (e.g. TopicRanker).
 * Producers emit events; consumers subscribe. No direct imports between layers.
 *
 * Events:
 *   SESSION_COMPLETED -- { studentId, sessionId, xpAwarded, accuracy, masteryDelta, masteryAfter, leveledUp, newLevel }
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';

const bus = new EventEmitter();
bus.setMaxListeners(20);

export interface SessionCompletedPayload {
  studentId: string;
  sessionId: string;
  xpAwarded: number;
  accuracy: number;       // 0-1
  masteryDelta: number;
  masteryAfter: number;
  leveledUp: boolean;
  newLevel: number | null;
  /** Newly awarded badge keys (empty if none). */
  badgesAwarded: string[];
  /** Current streak after this session (0 if streak update failed). */
  currentStreak: number;
}

export const SESSION_COMPLETED = 'SESSION_COMPLETED';

/**
 * Emit a domain event. Fire-and-forget; does not block.
 */
export function emitSessionCompleted(payload: SessionCompletedPayload): void {
  bus.emit(SESSION_COMPLETED, payload);
}

/**
 * Subscribe to SESSION_COMPLETED. Handler receives the full SessionCompletedPayload.
 */
export function onSessionCompleted(handler: (payload: SessionCompletedPayload) => void | Promise<void>): void {
  bus.on(SESSION_COMPLETED, (payload: SessionCompletedPayload) => {
    Promise.resolve(handler(payload)).catch((err) => {
      logger.warn('[DOMAIN_EVENT] SESSION_COMPLETED handler error', { payload, error: err });
    });
  });
}
