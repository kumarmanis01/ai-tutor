/**
 * FILE OBJECTIVE:
 * - Verify middleware exists and does not redirect authenticated session routes based on stale JWT onboarding flags.
 *
 * LINKED UNIT TEST:
 * - tests/auto/middleware.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | update coverage for active-account middleware guard on student routes
 * - 2026-05-07T00:00:00Z | copilot | add regression coverage for stale-token session-route redirects
 * - 2026-05-08T00:00:00Z | copilot | add /student auth guard coverage (redirect unauthenticated to /)
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { getToken } from 'next-auth/jwt';
import { middleware } from '../../middleware';

const mockedGetToken = jest.mocked(getToken);

describe('exists middleware.ts', () => {
  beforeEach(() => {
    mockedGetToken.mockReset();
    global.fetch = jest.fn(async () => {
      throw new Error('lookup not needed');
    }) as typeof fetch;
  });

  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'middleware.ts');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('allows authenticated session route even when JWT onboarding flags are stale', async () => {
    mockedGetToken.mockResolvedValue({
      role: 'student',
      onboardingComplete: false,
      accountStatus: 'pending_parent_verification',
    });

    const request = new NextRequest('https://example.com/session/topic-123');
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-pathname')).toBe('/session/topic-123');
  });

  it('redirects unauthenticated student routes to root', async () => {
    mockedGetToken.mockResolvedValue(null);

    const request = new NextRequest('https://example.com/student/onboarding');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/');
  });

  it('allows authenticated student routes', async () => {
    mockedGetToken.mockResolvedValue({ role: 'student', accountStatus: 'active' });

    const request = new NextRequest('https://example.com/student/onboarding');
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-pathname')).toBe('/student/onboarding');
  });

  it('redirects authenticated but inactive student routes to onboarding', async () => {
    mockedGetToken.mockResolvedValue({ role: 'student', accountStatus: 'pending_parent_verification' });

    const request = new NextRequest('https://example.com/student/dashboard');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/student/onboarding');
  });
});
