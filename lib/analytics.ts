// lib/analytics.ts
/**
 * Lightweight analytics helper
 * - non-blocking fire-and-forget
 * - records events server-side for admin metrics
 */

export async function logEvent(type: string, metadata?: Record<string, unknown>) {
  try {
    await fetch('/api/events/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, metadata }),
    });
  } catch (err) {
    // Don't break the app — best effort only
    console.warn('logEvent failed', err);
  }
}
