/**
 * FILE OBJECTIVE:
 * - Verify the Next.js proxy exists and preserves the expected auth and session-route behavior.
 *
 * LINKED UNIT TEST:
 * - tests/auto/proxy.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | add role-based cross-dashboard guard tests: parent->student redirect,
 *     student->parent redirect, inactive parent onboarding allowlist and destination
 * - 2026-05-19T00:00:00Z | copilot | migrate middleware coverage to the Next.js proxy convention
 * - 2026-05-12T00:00:00Z | copilot | update coverage for active-account middleware guard on student routes
 * - 2026-05-07T00:00:00Z | copilot | add regression coverage for stale-token session-route redirects
 * - 2026-05-08T00:00:00Z | copilot | add /student auth guard coverage
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
import { proxy } from '../../proxy';

const mockedGetToken = jest.mocked(getToken);

describe('exists proxy.ts', () => {
  beforeEach(() => {
    mockedGetToken.mockReset();
    global.fetch = jest.fn(async () => {
      throw new Error('lookup not needed');
    }) as typeof fetch;
  });

  it('source file exists on disk', () => {
    const filePath = path.join(process.cwd(), 'proxy.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('allows authenticated session route even when JWT onboarding flags are stale', async () => {
    mockedGetToken.mockResolvedValue({
      role: 'student',
      onboardingComplete: false,
      accountStatus: 'pending_parent_verification',
    });

    const request = new NextRequest('https://example.com/session/topic-123');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-pathname')).toBe('/session/topic-123');
  });

  it('redirects unauthenticated student routes to root', async () => {
    mockedGetToken.mockResolvedValue(null);

    const request = new NextRequest('https://example.com/student/onboarding');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/');
  });

  it('allows authenticated student routes', async () => {
    mockedGetToken.mockResolvedValue({ role: 'student', accountStatus: 'active' });

    const request = new NextRequest('https://example.com/student/onboarding');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-pathname')).toBe('/student/onboarding');
  });

  it('redirects authenticated but inactive student routes to onboarding', async () => {
    mockedGetToken.mockResolvedValue({ role: 'student', accountStatus: 'pending_parent_verification' });

    const request = new NextRequest('https://example.com/student/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/student/onboarding');
  });

  // ── Role-based cross-dashboard guard ──────────────────────────────────────

  it('redirects active parent hitting /dashboard to /parent/dashboard', async () => {
    mockedGetToken.mockResolvedValue({ role: 'parent', accountStatus: 'active' });

    const request = new NextRequest('https://example.com/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/parent/dashboard');
  });

  it('redirects active parent hitting /student/onboarding to /parent/dashboard', async () => {
    mockedGetToken.mockResolvedValue({ role: 'parent', accountStatus: 'active' });

    const request = new NextRequest('https://example.com/student/onboarding');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/parent/dashboard');
  });

  it('redirects active student (role=user) hitting /parent/dashboard to /dashboard', async () => {
    mockedGetToken.mockResolvedValue({ role: 'user', accountStatus: 'active' });

    const request = new NextRequest('https://example.com/parent/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/dashboard');
  });

  it('redirects inactive parent hitting /parent/dashboard to /parent/onboarding', async () => {
    mockedGetToken.mockResolvedValue({ role: 'parent', accountStatus: 'pending_setup' });

    const request = new NextRequest('https://example.com/parent/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/parent/onboarding');
  });

  it('allows inactive parent through /parent/onboarding (onboarding allowlist)', async () => {
    mockedGetToken.mockResolvedValue({ role: 'parent', accountStatus: 'pending_setup' });

    const request = new NextRequest('https://example.com/parent/onboarding');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-pathname')).toBe('/parent/onboarding');
  });

  it('allows active parent through /parent/dashboard', async () => {
    mockedGetToken.mockResolvedValue({ role: 'parent', accountStatus: 'active' });

    const request = new NextRequest('https://example.com/parent/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-pathname')).toBe('/parent/dashboard');
  });
});