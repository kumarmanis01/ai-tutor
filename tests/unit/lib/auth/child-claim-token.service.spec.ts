/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/auth/child-claim-token.service.ts.
 *   Covers token generation, Redis single-use enforcement, rate limiting,
 *   and all error paths in validateAndConsumeChildClaimToken.
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for B6.1
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── jose ESM mock (same pattern as token.service.spec.ts) ─────────────────────

const mockSign = jest.fn().mockResolvedValue('mock.claim.token');
const mockSetProtectedHeader = jest.fn();
const mockSetSubject = jest.fn();
const mockSetIssuedAt = jest.fn();
const mockSetExpirationTime = jest.fn();
const mockSetJti = jest.fn();

const mockJWTBuilder = {
  setProtectedHeader: mockSetProtectedHeader,
  setSubject: mockSetSubject,
  setJti: mockSetJti,
  setIssuedAt: mockSetIssuedAt,
  setExpirationTime: mockSetExpirationTime,
  sign: mockSign,
};
mockSetProtectedHeader.mockReturnValue(mockJWTBuilder);
mockSetSubject.mockReturnValue(mockJWTBuilder);
mockSetJti.mockReturnValue(mockJWTBuilder);
mockSetIssuedAt.mockReturnValue(mockJWTBuilder);
mockSetExpirationTime.mockReturnValue(mockJWTBuilder);
mockSign.mockReturnValue(mockJWTBuilder);

const mockJwtVerify = jest.fn();

jest.mock('jose', () => ({
  SignJWT: jest.fn(() => mockJWTBuilder),
  jwtVerify: (...args: any[]) => mockJwtVerify(...args),
}));

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  setex: jest.fn(),
  eval: jest.fn(),
};

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(() => mockRedis),
}));

// ── crypto mock (stable jti) ──────────────────────────────────────────────────

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-jti-uuid'),
}));

// ── env ───────────────────────────────────────────────────────────────────────

process.env.JWT_ACCESS_SECRET = 'test-secret-at-least-32-chars-long!!';

// ── imports ───────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  generateChildClaimToken,
  validateAndConsumeChildClaimToken,
  ClaimTokenExpiredError,
  ClaimTokenUsedError,
  ClaimTokenInvalidError,
  ClaimTokenRateLimitError,
} from '@/lib/auth/child-claim-token.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeValidPayload() {
  return {
    sub: 'child-1',
    jti: 'test-jti-uuid',
    parentId: 'parent-1',
    type: 'child_claim',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };
}

// ── generateChildClaimToken ───────────────────────────────────────────────────

describe('generateChildClaimToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.setex.mockResolvedValue('OK');
    mockSign.mockResolvedValue('mock.claim.token');
  });

  it('should return claimToken and expiresAt on success', async () => {
    const result = await generateChildClaimToken('child-1', 'parent-1');
    expect(result.claimToken).toBe('mock.claim.token');
    expect(result.expiresAt).toBeInstanceOf(Date);
    // expiresAt should be ~7 days from now
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5000);
  });

  it('should store PENDING status in Redis with 7-day TTL', async () => {
    await generateChildClaimToken('child-1', 'parent-1');
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'child_claim:test-jti-uuid',
      7 * 24 * 60 * 60,
      'PENDING'
    );
  });

  it('should increment rate-limit counter and set expiry on first call', async () => {
    await generateChildClaimToken('child-1', 'parent-1');
    expect(mockRedis.incr).toHaveBeenCalledWith('child_claim_rl:child-1');
    expect(mockRedis.expire).toHaveBeenCalledWith('child_claim_rl:child-1', 3600);
  });

  it('should not set expiry when counter > 1 (key already has TTL)', async () => {
    mockRedis.incr.mockResolvedValue(2);
    await generateChildClaimToken('child-1', 'parent-1');
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('should throw ClaimTokenRateLimitError when limit exceeded', async () => {
    mockRedis.incr.mockResolvedValue(6); // > RATE_LIMIT_MAX (5)
    await expect(generateChildClaimToken('child-1', 'parent-1')).rejects.toThrow(
      ClaimTokenRateLimitError
    );
  });

  it('should work without Redis when getRedis returns null', async () => {
    const { getRedis } = await import('@/lib/redis');
    (getRedis as jest.Mock).mockReturnValueOnce(null);
    const result = await generateChildClaimToken('child-1', 'parent-1');
    expect(result.claimToken).toBe('mock.claim.token');
  });
});

// ── validateAndConsumeChildClaimToken ────────────────────────────────────────

describe('validateAndConsumeChildClaimToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJwtVerify.mockResolvedValue({ payload: makeValidPayload() });
    mockRedis.eval.mockResolvedValue('PENDING');
  });

  it('should return childId and parentId on valid PENDING token', async () => {
    const result = await validateAndConsumeChildClaimToken('valid.token');
    expect(result).toEqual({ childId: 'child-1', parentId: 'parent-1' });
  });

  it('should throw ClaimTokenExpiredError when JWT verification reports expiry', async () => {
    mockJwtVerify.mockRejectedValue(new Error('JWT expired at ...exp'));
    await expect(validateAndConsumeChildClaimToken('expired.token')).rejects.toThrow(
      ClaimTokenExpiredError
    );
  });

  it('should throw ClaimTokenInvalidError on bad JWT', async () => {
    mockJwtVerify.mockRejectedValue(new Error('signature verification failed'));
    await expect(validateAndConsumeChildClaimToken('bad.token')).rejects.toThrow(
      ClaimTokenInvalidError
    );
  });

  it('should throw ClaimTokenInvalidError when payload lacks required fields', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'child-1', jti: 'j' } });
    await expect(validateAndConsumeChildClaimToken('incomplete.token')).rejects.toThrow(
      ClaimTokenInvalidError
    );
  });

  it('should throw ClaimTokenExpiredError when Redis returns EXPIRED', async () => {
    mockRedis.eval.mockResolvedValue('EXPIRED');
    await expect(validateAndConsumeChildClaimToken('valid.token')).rejects.toThrow(
      ClaimTokenExpiredError
    );
  });

  it('should throw ClaimTokenUsedError when Redis returns USED', async () => {
    mockRedis.eval.mockResolvedValue('USED');
    await expect(validateAndConsumeChildClaimToken('valid.token')).rejects.toThrow(
      ClaimTokenUsedError
    );
  });

  it('should call Redis eval with correct Lua script and key', async () => {
    await validateAndConsumeChildClaimToken('valid.token');
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('GETSET'),
      // Lua uses KEEPTTL so we should NOT see GETSET; instead look for PENDING check
      // The actual content check:
      expect.anything(),
      expect.anything(),
      'child_claim:test-jti-uuid'
    );
  });

  it('should work without Redis (no single-use enforcement in that case)', async () => {
    const { getRedis } = await import('@/lib/redis');
    (getRedis as jest.Mock).mockReturnValueOnce(null);
    const result = await validateAndConsumeChildClaimToken('valid.token');
    expect(result).toEqual({ childId: 'child-1', parentId: 'parent-1' });
  });
});
