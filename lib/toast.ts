import { logger } from '@/lib/logger';
export function toast(message: string, duration = 5000) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, duration } }));
  } catch {
    // Fallback: route through central logger
    logger.add(`[toast] ${message}`, { className: 'toast', methodName: 'toast' });
  }
}
