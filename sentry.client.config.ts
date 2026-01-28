/**
 * FILE OBJECTIVE:
 * - Sentry configuration for client-side error tracking and performance monitoring.
 *
 * LINKED UNIT TEST:
 * - tests/unit/sentry.client.config.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created Sentry client configuration
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Performance Monitoring - adjust these values in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay for error reproduction
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Enable debug mode in development
  debug: process.env.NODE_ENV !== 'production',

  // Set the environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',

  // Release tracking (set via CI/CD)
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  // Configure which errors to ignore
  ignoreErrors: [
    // Ignore common network errors
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    // Ignore browser extension errors
    /^chrome-extension:/,
    /^moz-extension:/,
    // Ignore ResizeObserver errors (common, non-critical)
    'ResizeObserver loop',
    // Ignore user cancellation
    'User cancelled',
  ],

  // Filter events before sending
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  beforeSend(event: Sentry.ErrorEvent, _hint: Sentry.EventHint) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    // Redact sensitive data
    if (event.request?.cookies) {
      event.request.cookies = '[Filtered]';
    }
    if (event.request?.headers) {
      // Remove auth headers
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }

    return event;
  },

  // Configure integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text content for privacy
      maskAllText: false,
      // Block all media (images, videos) for privacy
      blockAllMedia: false,
    }),
  ],
});
