import { logger } from '@/lib/logger';
/**
 * Small realtime broadcaster:
 * - Provides in-memory pub/sub for SSE streams (development, single-instance)
 * - Exposes adapter points to swap with Redis Pub/Sub (production)
 *
 * API:
 *  subscribe(roomId, onMessage) -> returns unsubscribe()
 *  publish(roomId, payload)
 */

// Use a generic type for payloads
export type RealtimePayload = {
  type: string;
  payload: unknown; // Replace 'unknown' with a more specific type if you know it
};

type Subscriber = (payload: RealtimePayload) => void;

const subscribers = new Map<string, Set<Subscriber>>();

// subscribe to a single room
export function subscribe(roomId: string, onMessage: Subscriber) {
  if (!subscribers.has(roomId)) subscribers.set(roomId, new Set());
  subscribers.get(roomId)!.add(onMessage);

  // return unsubscribe
  return () => {
    const s = subscribers.get(roomId);
    if (!s) return;
    s.delete(onMessage);
    if (s.size === 0) subscribers.delete(roomId);
  };
}

// publish to a room
export function publish(roomId: string, payload: RealtimePayload) {
  const s = subscribers.get(roomId);
  if (!s) return;
  for (const cb of Array.from(s)) {
    try {
      cb(payload);
    } catch (e) {
      logger.error(`subscriber error: ${String(e)}`, { className: 'realtime', methodName: 'publish' });
    }
  }
}

/*
Production note:
- Replace the above in-memory implementation with a Redis pub/sub adapter:
  - On publish: PUBLISH channel `room:${roomId}` with JSON payload
  - On subscribe: SUBSCRIBE to channel `room:${roomId}` and forward to SSE clients
- Keep interface same so lib/roomService.ts and APIs don't change.
*/
