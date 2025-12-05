export function toast(message: string, duration = 5000) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, duration } }));
  } catch (e) {
    // If dispatch fails (very unlikely), fallback to console.log so server-side
    // environments and tests don't trigger browser alerts.
    console.log('[toast]', message, e);
  }
}
