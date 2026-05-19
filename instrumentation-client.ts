/**
 * FILE OBJECTIVE:
 * - Initialize client-side Sentry monitoring through the Next.js instrumentation-client
 *   convention using environment-driven configuration.
 *
 * LINKED UNIT TEST:
 * - tests/unit/instrumentation-client.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | copilot | consolidate deprecated sentry.client.config.ts into instrumentation-client.ts
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_ENVIRONMENT = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development';
const DEFAULT_RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA;
const IGNORED_ERRORS = [
  'Network request failed',
  'Failed to fetch',
  'NetworkError',
  'AbortError',
  /^chrome-extension:/,
  /^moz-extension:/,
  'ResizeObserver loop',
  'User cancelled',
];
const REPLAY_INTEGRATIONS = typeof Sentry.replayIntegration === 'function'
  ? [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ]
  : [];

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: IS_PRODUCTION && Boolean(SENTRY_DSN),
  tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: !IS_PRODUCTION,
  environment: DEFAULT_ENVIRONMENT,
  release: DEFAULT_RELEASE,
  ignoreErrors: IGNORED_ERRORS,
  beforeSend(event: Sentry.ErrorEvent) {
    if (!IS_PRODUCTION) {
      return null;
    }

    if (event.request?.cookies) {
      event.request.cookies = '[Filtered]';
    }
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    return event;
  },
  integrations: REPLAY_INTEGRATIONS,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
