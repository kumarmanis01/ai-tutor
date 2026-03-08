/**
 * Domain event bus (COUPLING-01).
 *
 * Decouples producers (e.g. SessionEngine) from consumers (e.g. TopicRanker).
 * Producers emit events; consumers subscribe. No direct imports between layers.
 *
 * Events:
 *   SESSION_COMPLETED — { studentId: string, sessionId: string }
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';

const bus = new EventEmitter();
bus.setMaxListeners(20);

export type SessionCompletedPayload = { studentId: string; sessionId: string };

export const SESSION_COMPLETED = 'SESSION_COMPLETED';

/**
 * Emit a domain event. Fire-and-forget; does not block.
 */
export function emitSessionCompleted(payload: SessionCompletedPayload): void {
  bus.emit(SESSION_COMPLETED, payload);
}

/**
 * Subscribe to SESSION_COMPLETED. Handler receives { studentId }.
 */
export function onSessionCompleted(handler: (payload: SessionCompletedPayload) => void | Promise<void>): void {
  bus.on(SESSION_COMPLETED, (payload: SessionCompletedPayload) => {
    Promise.resolve(handler(payload)).catch((err) => {
      logger.warn('[DOMAIN_EVENT] SESSION_COMPLETED handler error', { payload, error: err });
    });
  });
}
