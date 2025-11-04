export async function trackEvent(event: string, data?: Record<string, unknown>) {
  // Log to console when trackEvent is invoked
  console.log('[analytics] trackEvent called', { event, data, ts: Date.now() });

  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, ts: Date.now() }),
    });
  } catch (e) {
    // fail silently in production; you can add retry/logging here
    console.error('analytics track failed', e);
  }
}
