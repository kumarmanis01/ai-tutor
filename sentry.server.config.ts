/**
 * FILE OBJECTIVE:
 * - Sentry configuration for server-side error tracking and performance monitoring.
 *
 * LINKED UNIT TEST:
 * - tests/unit/sentry.server.config.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created Sentry server configuration
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Performance Monitoring - lower sample rate for server
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  // Set the environment
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

  // Release tracking
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  // Configure which errors to ignore
  ignoreErrors: [
    // Ignore connection reset errors
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    // Ignore "too many requests" which are expected
    'Too many requests',
    'Rate limit exceeded',
  ],

  // Filter events before sending
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    // Redact sensitive data from event
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      // Remove sensitive cookies
      if (event.request.cookies) {
        event.request.cookies = '[Filtered]';
      }
    }

    // Redact user PII if present
    if (event.user) {
      // Keep user ID for debugging but remove email
      delete event.user.email;
      delete event.user.ip_address;
    }

    return event;
  },

  // Configure integrations
  integrations: [
    // Database query tracing (if using Prisma)
    Sentry.prismaIntegration(),
  ],
});
