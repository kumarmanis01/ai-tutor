export async function trackEvent(event: string, data?: Record<string, unknown>) {
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
