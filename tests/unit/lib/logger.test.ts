/**
 * FILE OBJECTIVE:
 * - Unit tests for `lib/logger.ts` covering subscription, level gating,
 *   sanitization, and `logAPI` behaviour.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/logger.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add unit tests for logger features
 */

describe('logger (unit)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV } as NodeJS.ProcessEnv;
  });
  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('subscribe returns an unsubscribe function and close is safe', async () => {
    process.env.NODE_ENV = 'production';
    // Ensure server-level logs are gated to 'error' so info is suppressed if applicable
    process.env.LOG_LEVEL = 'error';
    jest.resetModules();
    const { logger } = await import('@/lib/logger');
    const cb = jest.fn();
    const unsub = logger.subscribe(cb);
    expect(typeof unsub).toBe('function');
    // Calling add may or may not call subscribers depending on global env.
    // Ensure close() is safe to call in all environments.
    logger.info('should not log', { foo: 'bar' });
    logger.close();
  });

  it('allows subscribing, replays logs, and sanitizes structured output when WORKER_DEBUG=1', async () => {
    process.env.WORKER_DEBUG = '1';
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { logger } = await import('@/lib/logger');
    // Add a log before subscribing
    logger.info('initial', { className: 'C1', methodName: 'm1' });

    const cb = jest.fn();
    const unsub = logger.subscribe(cb);
    expect(typeof unsub).toBe('function');
    // subscribe replays prior logs
    expect(cb).toHaveBeenCalled();

    // Now add a log with sensitive fields that should be sanitized in structured output
    logger.info('sensitive', { email: 'a@b.com', token: 'secret-token', rawAnswer: '42' });

    // output() emits structured JSON via console.log; ensure it was called and
    // find the payload that corresponds to the sensitive event.
    expect(consoleLog).toHaveBeenCalled();
    const calls = consoleLog.mock.calls.flat();
    const jsonCall = calls.find((c) => {
      try {
        const p = JSON.parse(String(c));
        return String(p.event || '').includes('sensitive');
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(String(jsonCall));
    // Context should exist and contain redacted markers for email/answer
    expect(parsed.context).toBeDefined();
    const ctxStr = JSON.stringify(parsed.context);
    expect(ctxStr).toMatch(/REDACTED_EMAIL|REDACTED_ANSWER|REDACTED/);

    // cleanup
    unsub();
    logger.close();
  });

  it('logAPI pretty prints request/response metadata when NEXT_PUBLIC_DEBUG_MODE=true', async () => {
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
    process.env.WORKER_DEBUG = '1';
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');

    // Create fake Request/Response with clone().text() returning JSON strings
    const fakeReq: any = {
      url: '/api/test',
      method: 'POST',
      clone() {
        return { text: async () => JSON.stringify({ a: 1, b: 2 }) };
      },
    };
    const fakeRes: any = {
      status: 200,
      clone() {
        return { text: async () => JSON.stringify({ ok: true }) };
      },
    };

    await logger.logAPI(fakeReq as any, fakeRes as any, { className: 'API' }, Date.now() - 5);

    // Instead of relying on console.log side-effects, assert the pretty JSON
    // was added to the internal logs (logAPI uses this.add with the JSON payload)
    const logs = logger.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    const first = logs.find(
      (l) => String(l).includes('/api/test') || String(l).includes('"route"')
    );
    expect(first).toBeDefined();

    logger.close();
  });
});
jest.useRealTimers();

describe('logger module', () => {
  const oldEnv = { ...process.env };
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    process.env = { ...oldEnv };
  });

  it('sanitizes sensitive fields and routes output to console.log/info', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'false';
    jest.resetModules();
    const { info } = require('@/lib/logger.js');

    info('test.event', { token: 'abc.def.ghi', email: 'foo@bar.com', rawAnswer: '42' });

    expect(consoleLogSpy).toHaveBeenCalled();
    const line = consoleLogSpy.mock.calls[0][0];
    const payload = JSON.parse(line);
    expect(payload.level).toBe('info');
    expect(payload.context.token).toBe('[REDACTED]');
    expect(payload.context.email).toBe('[REDACTED_EMAIL]');
    expect(payload.context.rawAnswer).toBe('[REDACTED_ANSWER]');
  });

  it('routes warn/error to stderr', () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    const { warn, error } = require('@/lib/logger.js');

    warn('warn.event', { some: 'value' });
    error('err.event', { some: 'value' });

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrSpy).toHaveBeenCalled();
  });

  it('logger.subscribe and getLogs obey debug env', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
    jest.resetModules();
    const { logger } = require('@/lib/logger.js');

    const received: string[] = [];
    const unsub = logger.subscribe((m: string) => received.push(m));

    logger.info('sub.test', { className: 'C' });

    expect(received.length).toBeGreaterThanOrEqual(1);
    const logs = logger.getLogs();
    expect(Array.isArray(logs)).toBe(true);

    unsub();
    logger.close();
  });

  it('logAPI pretty prints request/response metadata', async () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
    jest.resetModules();
    const { logger } = require('@/lib/logger.js');

    const received: string[] = [];
    const unsub = logger.subscribe((m: string) => received.push(m));

    // Fake Request/Response-like objects with clone().text()
    const req: any = {
      url: '/api/test',
      method: 'POST',
      clone: () => ({ text: async () => JSON.stringify({ a: 1, b: 2 }) }),
    };
    const res: any = {
      status: 200,
      clone: () => ({ text: async () => JSON.stringify({ ok: true }) }),
    };

    await logger.logAPI(req as any, res as any, { methodName: 'm' }, Date.now() - 50);

    expect(received.length).toBeGreaterThanOrEqual(1);
    const found = received.find((r) => r.includes('/api/test'));
    expect(found).toBeTruthy();

    unsub();
    logger.close();
  });

  it('respects LOG_LEVEL parse fallback and suppresses low-level logs', () => {
    // set an invalid LOG_LEVEL so parseLevel falls back to 'error'
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'not-a-level';
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'false';
    process.env.WORKER_DEBUG = 'false';
    jest.resetModules();
    const { logger } = require('@/lib/logger.js');

    const received: string[] = [];
    const unsub = logger.subscribe((m: string) => received.push(m));

    // debug should be suppressed because server min level is error
    logger.debug('should.suppress', { foo: 'bar' });
    expect(received.length).toBe(0);

    unsub();
    logger.close();
  });

  it('safeSerializeContext falls back on circular structures', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
    jest.resetModules();
    const { logger } = require('@/lib/logger.js');

    const received: string[] = [];
    const unsub = logger.subscribe((m: string) => received.push(m));

    const a: any = {};
    a.self = a; // circular

    logger.debug('circ.test', a);

    expect(received.length).toBeGreaterThanOrEqual(1);
    const entry = received[received.length - 1];
    expect(entry).toContain('circ.test');

    unsub();
    logger.close();
  });
});
