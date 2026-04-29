/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/parent/children/[childId]/generate-claim-link/route.ts
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for B6.1
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../../../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));
jest.mock('@/lib/audit/log', () => ({ default: jest.fn() }));
jest.mock('@/lib/auth/child-claim-token.service', () => ({
  generateChildClaimToken: jest.fn(),
  ClaimTokenRateLimitError: class ClaimTokenRateLimitError extends Error {
    constructor() {
      super('rate limited');
      this.name = 'ClaimTokenRateLimitError';
    }
  },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../../../../../helpers/prismaMock';
import '../../../../../../helpers/mockSession';
import {
  generateChildClaimToken,
  ClaimTokenRateLimitError,
} from '@/lib/auth/child-claim-token.service';

const CHILD_ID = 'child-abc';
const PARENT_ID = 'parent-xyz';

function makeRequest(): Request {
  return new Request(`http://localhost/api/v1/parent/children/${CHILD_ID}/generate-claim-link`, {
    method: 'POST',
  });
}

describe('POST /api/v1/parent/children/[childId]/generate-claim-link', () => {
  beforeEach(() => {
    resetPrismaMock();
    (global as any).__TEST_SESSION__ = {
      user: { id: PARENT_ID, role: 'parent', email: 'parent@example.test' },
    };
    (generateChildClaimToken as jest.Mock).mockResolvedValue({
      claimToken: 'mock.claim.token',
      expiresAt: new Date('2026-05-06T00:00:00Z'),
    });
    process.env.NEXT_PUBLIC_APP_URL = 'https://spinzyacademy.com';
  });

  it('should return 401 when session is missing', async () => {
    (global as any).__TEST_SESSION__ = null;
    const { POST } = await import(
      '@/app/api/v1/parent/children/[childId]/generate-claim-link/route'
    );
    const res = (await POST(makeRequest(), { params: { childId: CHILD_ID } })) as any;
    expect(res.status).toBe(401);
  });

  it('should return 404 when parent does not own the child', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue(null);
    const { POST } = await import(
      '@/app/api/v1/parent/children/[childId]/generate-claim-link/route'
    );
    const res = (await POST(makeRequest(), { params: { childId: CHILD_ID } })) as any;
    expect(res.status).toBe(404);
  });

  it('should return 404 when parentStudent link is not active', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'revoked' } as any);
    const { POST } = await import(
      '@/app/api/v1/parent/children/[childId]/generate-claim-link/route'
    );
    const res = (await POST(makeRequest(), { params: { childId: CHILD_ID } })) as any;
    expect(res.status).toBe(404);
  });

  it('should return 200 with claimToken, deepLink, expiresAt on success', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'active' } as any);
    const { POST } = await import(
      '@/app/api/v1/parent/children/[childId]/generate-claim-link/route'
    );
    const res = (await POST(makeRequest(), { params: { childId: CHILD_ID } })) as any;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.claimToken).toBe('mock.claim.token');
    expect(body.deepLink).toContain('/student/claim?token=mock.claim.token');
    expect(body.expiresAt).toBe('2026-05-06T00:00:00.000Z');
  });

  it('should return 429 when rate limit is exceeded', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'active' } as any);
    (generateChildClaimToken as jest.Mock).mockRejectedValue(new ClaimTokenRateLimitError());
    const { POST } = await import(
      '@/app/api/v1/parent/children/[childId]/generate-claim-link/route'
    );
    const res = (await POST(makeRequest(), { params: { childId: CHILD_ID } })) as any;
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
  });

  it('should return 500 on unexpected errors', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'active' } as any);
    (generateChildClaimToken as jest.Mock).mockRejectedValue(new Error('db exploded'));
    const { POST } = await import(
      '@/app/api/v1/parent/children/[childId]/generate-claim-link/route'
    );
    const res = (await POST(makeRequest(), { params: { childId: CHILD_ID } })) as any;
    expect(res.status).toBe(500);
  });
});
