/**
 * Unit tests for POST /api/student/session/feedback
 *
 * EDIT LOG:
 * - 2026-04-22 | claude | initial test suite per review request
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const USER_ID = 'student-test-1';
const SESSION_ID = 'sess-abc-123';

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/student/session/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/student/session/feedback', () => {
  let getServerSessionForHandlers: jest.Mock;
  let loggerInfo: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    getServerSessionForHandlers = require('@/lib/session').getServerSessionForHandlers;
    loggerInfo = require('@/lib/logger').logger.info;
    getServerSessionForHandlers.mockResolvedValue({ user: { id: USER_ID } });
  });

  it('should return 401 when unauthenticated', async () => {
    getServerSessionForHandlers.mockResolvedValue(null);
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(makeRequest({ rating: 4 }) as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 on malformed JSON body', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const req = new Request('http://localhost/api/student/session/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should return 400 when rating is below 1', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(makeRequest({ rating: 0 }) as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should return 400 when rating is above 5', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(makeRequest({ rating: 6 }) as any);
    expect(res.status).toBe(400);
  });

  it('should return 400 when rating is a string', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(makeRequest({ rating: '4' }) as any);
    expect(res.status).toBe(400);
  });

  it('should return 200 and log feedback on valid submission', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, rating: 4, phase: 'EXPLANATION' }) as any
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(loggerInfo).toHaveBeenCalledWith(
      'session_feedback',
      expect.objectContaining({
        event: 'session_feedback_submitted',
        context: expect.objectContaining({ userId: USER_ID, rating: 4 }),
      })
    );
  });

  it('should coerce non-string sessionId to null in log', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(makeRequest({ sessionId: 12345, rating: 3 }) as any);
    expect(res.status).toBe(200);
    expect(loggerInfo).toHaveBeenCalledWith(
      'session_feedback',
      expect.objectContaining({
        context: expect.objectContaining({ sessionId: null }),
      })
    );
  });

  it('should accept rating of 1 (boundary)', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(makeRequest({ rating: 1 }) as any);
    expect(res.status).toBe(200);
  });

  it('should accept rating of 5 (boundary)', async () => {
    const { POST } = await import('@/app/api/student/session/feedback/route');
    const res = await POST(makeRequest({ rating: 5 }) as any);
    expect(res.status).toBe(200);
  });
});
