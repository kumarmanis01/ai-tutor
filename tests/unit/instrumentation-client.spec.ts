/**
 * FILE OBJECTIVE:
 * - Verify client-side Sentry instrumentation initializes from environment configuration
 *   and redacts request metadata before sending events.
 *
 * LINKED UNIT TEST:
 * - tests/unit/instrumentation-client.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | copilot | add coverage for instrumentation-client Sentry initialization
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const initMock = jest.fn();
const replayIntegrationMock = jest.fn(() => ({ name: 'replay' }));
const captureRouterTransitionStartMock = jest.fn();

jest.mock('@sentry/nextjs', () => ({
  init: initMock,
  replayIntegration: replayIntegrationMock,
  captureRouterTransitionStart: captureRouterTransitionStartMock,
}));

describe('instrumentation-client', () => {
  beforeEach(() => {
    jest.resetModules();
    initMock.mockReset();
    replayIntegrationMock.mockClear();
    captureRouterTransitionStartMock.mockClear();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_RELEASE;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.NODE_ENV = 'test';
  });

  it('should initialize Sentry with production-safe env configuration when enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.NEXT_PUBLIC_SENTRY_RELEASE = 'release-123';
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview';

    const module = await import('../../instrumentation-client');

    expect(replayIntegrationMock).toHaveBeenCalledWith({
      maskAllText: false,
      blockAllMedia: false,
    });
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
        enabled: true,
        tracesSampleRate: 0.1,
        environment: 'preview',
        release: 'release-123',
      }),
    );
    expect(module.onRouterTransitionStart).toBe(captureRouterTransitionStartMock);

    const initConfig = initMock.mock.calls[0][0] as { beforeSend: (event: any) => any };
    const event = {
      request: {
        cookies: 'session=value',
        headers: {
          authorization: 'Bearer token',
          cookie: 'session=value',
          accept: 'application/json',
        },
      },
    };

    expect(initConfig.beforeSend(event)).toEqual({
      request: {
        cookies: '[Filtered]',
        headers: {
          accept: 'application/json',
        },
      },
    });
  });

  it('should disable sending events outside production', async () => {
    await import('../../instrumentation-client');

    const initConfig = initMock.mock.calls[0][0] as { enabled: boolean; beforeSend: (event: any) => any };
    expect(initConfig.enabled).toBe(false);
    expect(initConfig.beforeSend({ request: {} })).toBeNull();
  });
});