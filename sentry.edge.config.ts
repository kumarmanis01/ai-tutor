/**
 * FILE OBJECTIVE:
 * - Sentry configuration for Edge Runtime (middleware, edge functions).
 *
 * LINKED UNIT TEST:
 * - tests/unit/sentry.edge.config.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created Sentry edge configuration
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Lower sample rate for edge functions
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 1.0,

  // Set the environment
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

  // Release tracking
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
});
