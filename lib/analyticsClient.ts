/**
 * Client-side analytics helper
 *
 * - Queues events and flushes periodically to reduce request churn.
 * - Retries failed events with exponential backoff.
 * - Uses navigator.sendBeacon on page unload/visibilitychange to flush remaining events.
 * - Safe no-op on non-browser environments.
 *
 * Keep this file free of server-only imports so it can be imported from client components.
 */

import { logger } from '@/lib/logger';

type EventPayload = {
  event: string;
  data?: Record<string, unknown> | null;
  ts: number;
  _attempt?: number;
};

const QUEUE: EventPayload[] = [];
let flushTimer: number | null = null;
let isFlushing = false;

const FLUSH_INTERVAL_MS = 2000; // flush every 2s when events queued
const MAX_BATCH_SIZE = 10; // process up to 10 events per flush cycle
const REQUEST_TIMEOUT_MS = 7000; // abort fetch after 7s
const MAX_RETRIES = 3; // max retry attempts per event
const BACKOFF_BASE_MS = 1000; // base backoff

function nowTs() {
  return Date.now();
}

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    try {
      logger.debug(`[analyticsClient] ${args.map((a) => String(a)).join(' ')}`, { className: 'analyticsClient' });
    } catch {
      // silent fallback when logger fails
    }
  }
}

async function postEvent(event: EventPayload): Promise<boolean> {
  // Single-event POST to keep server compatibility with existing /api/analytics/track
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: event.event, data: event.data ?? null, ts: event.ts }),
      signal: controller.signal,
    });
    return res.ok;
  } catch (err) {
    debugLog('postEvent error', err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function flushOnce(): Promise<void> {
  if (isFlushing) return;
  if (QUEUE.length === 0) return;

  isFlushing = true;
  try {
    // take up to MAX_BATCH_SIZE items
    const batch = QUEUE.splice(0, MAX_BATCH_SIZE);
    debugLog('flushing batch', batch.length);

    // send sequentially so we can retry failed items individually
    for (const ev of batch) {
      const ok = await postEvent(ev);
      if (!ok) {
        ev._attempt = (ev._attempt ?? 0) + 1;
        if (ev._attempt <= MAX_RETRIES) {
          // schedule retry with exponential backoff: push back into queue after delay
          const backoff = BACKOFF_BASE_MS * 2 ** (ev._attempt - 1);
          setTimeout(() => {
            QUEUE.push(ev);
            scheduleFlush();
          }, backoff);
        } else {
          // give up after max retries; optionally log to console in dev
          debugLog('dropping event after max retries', ev);
        }
      }
    }
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushOnce();
    // if there are still items, schedule another cycle
    if (QUEUE.length > 0) scheduleFlush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Public API: trackEvent
 * - Fire-and-forget: returns a Promise that resolves once the event is queued.
 * - Use trackEvent(...) from client components only.
 */
export async function trackEvent(
  event: string,
  data?: Record<string, unknown> | null,
): Promise<void> {
  if (typeof window === 'undefined') return;

  const payload: EventPayload = { event, data: data ?? null, ts: nowTs(), _attempt: 0 };
  QUEUE.push(payload);
  debugLog('queued', payload);
  scheduleFlush();
}

/**
 * Flush remaining events using navigator.sendBeacon (best-effort) for unload scenarios.
 * sendBeacon sends a small payload; we iterate queued events and try to send each.
 */
function flushWithBeacon() {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return;
  }
  try {
    while (QUEUE.length > 0) {
      const ev = QUEUE.shift()!;
      const body = JSON.stringify({ event: ev.event, data: ev.data ?? null, ts: ev.ts });
      // sendBeacon returns boolean success; ignore failures (best-effort)
      // Content type isn't settable with sendBeacon easily, server should handle text/plain JSON.
      navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' }));
      debugLog('sendBeacon sent', ev.event);
    }
  } catch (err) {
    debugLog('sendBeacon failed', err);
  }
}

/**
 * Install unload handlers once (idempotent)
 */
function installUnloadHandlers() {
  if (typeof window === 'undefined') return;
  // avoid multiple installations
  if ((installUnloadHandlers as unknown as { done?: boolean }).done) return;
  (installUnloadHandlers as unknown as { done?: boolean }).done = true;

  // Try to flush when page visibility changes (user moves to background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushWithBeacon();
    }
  });

  // Also flush on beforeunload as a fallback
  window.addEventListener('beforeunload', () => {
    flushWithBeacon();
  });
}

// auto-install when module is loaded in browser
if (typeof window !== 'undefined') {
  installUnloadHandlers();
}

const analyticsClient = { trackEvent };
export default analyticsClient;
