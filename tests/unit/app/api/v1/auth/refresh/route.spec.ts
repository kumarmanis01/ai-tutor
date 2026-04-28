/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/auth/refresh/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created tests for refresh token rotation route
 */

jest.mock('@/lib/auth/token.service', () => ({
  generateTokenPair: jest.fn(),
  verifyUserRefreshToken: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  TokenInvalidError: class TokenInvalidError extends Error {},
}));

jest.mock('@/lib/auth/blacklist.service', () => ({
  blacklistToken: jest.fn(),
  isBlacklisted: jest.fn(),
}));

import { POST } from '@/app/api/v1/auth/refresh/route';
import { generateTokenPair, verifyUserRefreshToken } from '@/lib/auth/token.service';
import { blacklistToken, isBlacklisted } from '@/lib/auth/blacklist.service';
import { NextRequest } from 'next/server';

const mockGenerateTokenPair = generateTokenPair as jest.MockedFunction<typeof generateTokenPair>;
const mockVerifyRefresh = verifyUserRefreshToken as jest.MockedFunction<typeof verifyUserRefreshToken>;
const mockBlacklistToken = blacklistToken as jest.MockedFunction<typeof blacklistToken>;
const mockIsBlacklisted = isBlacklisted as jest.MockedFunction<typeof isBlacklisted>;

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerifyRefresh.mockResolvedValue({
      sub: 'user-1',
      role: 'user',
      scope: 'user',
      jti: 'old-jti',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mockBlacklistToken.mockResolvedValue(undefined);
    mockGenerateTokenPair.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('should return 400 when refresh token is missing', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('should return 401 when token is already revoked', async () => {
    mockIsBlacklisted.mockResolvedValue(true);
    const res = await POST(req({ refreshToken: 'old-refresh' }));
    expect(res.status).toBe(401);
  });

  it('should rotate token and return fresh pair on valid request', async () => {
    const res = await POST(req({ refreshToken: 'old-refresh' }));
    const body = (await res.json()) as { accessToken: string; refreshToken: string };

    expect(res.status).toBe(200);
    expect(mockBlacklistToken).toHaveBeenCalledWith('old-jti', expect.any(Number));
    expect(mockGenerateTokenPair).toHaveBeenCalledWith({ sub: 'user-1', role: 'user', scope: 'user' });
    expect(body).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });
});
