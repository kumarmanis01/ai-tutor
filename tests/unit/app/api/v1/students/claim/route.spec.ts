/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/students/claim/route.ts
 *   Covers happy path, all token error states, and missing profile.
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for B6.1 / S0.5
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../../../helpers/prismaMock').prismaMock }));
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

// Mock token service with typed error classes
jest.mock('@/lib/auth/child-claim-token.service', () => ({
  validateAndConsumeChildClaimToken: jest.fn(),
  ClaimTokenExpiredError: class ClaimTokenExpiredError extends Error {
    constructor() { super('expired'); this.name = 'ClaimTokenExpiredError'; }
  },
  ClaimTokenUsedError: class ClaimTokenUsedError extends Error {
    constructor() { super('used'); this.name = 'ClaimTokenUsedError'; }
  },
  ClaimTokenInvalidError: class ClaimTokenInvalidError extends Error {
    constructor() { super('invalid'); this.name = 'ClaimTokenInvalidError'; }
  },
}));

jest.mock('@/lib/auth/token.service', () => ({
  generateTokenPair: jest.fn().mockResolvedValue({
    accessToken: 'access.jwt',
    refreshToken: 'refresh.jwt',
  }),
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../../../../helpers/prismaMock';
import {
  validateAndConsumeChildClaimToken,
  ClaimTokenExpiredError,
  ClaimTokenUsedError,
  ClaimTokenInvalidError,
} from '@/lib/auth/child-claim-token.service';

const CHILD_ID = 'child-abc';
const PARENT_ID = 'parent-xyz';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/v1/students/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/students/claim', () => {
  beforeEach(() => {
    resetPrismaMock();
    (validateAndConsumeChildClaimToken as jest.Mock).mockResolvedValue({
      childId: CHILD_ID,
      parentId: PARENT_ID,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: CHILD_ID,
      name: 'Aarav',
      accountStatus: 'active',
    } as any);
    prismaMock.user.update.mockResolvedValue({} as any);
    prismaMock.$queryRaw.mockResolvedValue([{ grade: '5', board: 'CBSE' }]);
  });

  it('should return 400 when claimToken is missing', async () => {
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({}))) as any;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('claim_token_required');
  });

  it('should return 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const req = new Request('http://localhost/api/v1/students/claim', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = (await POST(req)) as any;
    expect(res.status).toBe(400);
  });

  it('should return accessToken, refreshToken and child info on success', async () => {
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({ claimToken: 'valid.token' }))) as any;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.accessToken).toBe('access.jwt');
    expect(body.refreshToken).toBe('refresh.jwt');
    expect(body.child.id).toBe(CHILD_ID);
    expect(body.child.name).toBe('Aarav');
    expect(body.child.grade).toBe('5');
    expect(body.child.board).toBe('CBSE');
  });

  it('should return 401 on expired token', async () => {
    (validateAndConsumeChildClaimToken as jest.Mock).mockRejectedValue(
      new ClaimTokenExpiredError()
    );
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({ claimToken: 'expired.token' }))) as any;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('token_expired');
    expect(body.message).toContain('expired');
  });

  it('should return 409 on already-used token', async () => {
    (validateAndConsumeChildClaimToken as jest.Mock).mockRejectedValue(new ClaimTokenUsedError());
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({ claimToken: 'used.token' }))) as any;
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('token_used');
  });

  it('should return 401 on invalid token', async () => {
    (validateAndConsumeChildClaimToken as jest.Mock).mockRejectedValue(
      new ClaimTokenInvalidError()
    );
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({ claimToken: 'bad.token' }))) as any;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('token_invalid');
  });

  it('should return 404 when child profile does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({ claimToken: 'valid.token' }))) as any;
    expect(res.status).toBe(404);
  });

  it('should return 500 on unexpected server errors', async () => {
    (validateAndConsumeChildClaimToken as jest.Mock).mockRejectedValue(new Error('db exploded'));
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({ claimToken: 'valid.token' }))) as any;
    expect(res.status).toBe(500);
  });

  it('should activate account when status is not active', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: CHILD_ID,
      name: 'Aarav',
      accountStatus: 'pending_parent_verification',
    } as any);
    const { POST } = await import('@/app/api/v1/students/claim/route');
    const res = (await POST(makeRequest({ claimToken: 'valid.token' }))) as any;
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: CHILD_ID },
      data: { accountStatus: 'active' },
    });
  });
});
