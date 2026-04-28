/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/auth/logout/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created tests for logout token revocation route
 */

jest.mock('@/lib/auth/token.service', () => ({
  verifyUserAccessToken: jest.fn(),
  verifyUserRefreshToken: jest.fn(),
}));

jest.mock('@/lib/auth/blacklist.service', () => ({
  blacklistToken: jest.fn(),
}));

import { POST } from '@/app/api/v1/auth/logout/route';
import { verifyUserAccessToken, verifyUserRefreshToken } from '@/lib/auth/token.service';
import { blacklistToken } from '@/lib/auth/blacklist.service';
import { NextRequest } from 'next/server';

const mockVerifyAccess = verifyUserAccessToken as jest.MockedFunction<typeof verifyUserAccessToken>;
const mockVerifyRefresh = verifyUserRefreshToken as jest.MockedFunction<typeof verifyUserRefreshToken>;
const mockBlacklist = blacklistToken as jest.MockedFunction<typeof blacklistToken>;

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAccess.mockResolvedValue({ jti: 'a-jti', exp: 111111 } as never);
    mockVerifyRefresh.mockResolvedValue({ jti: 'r-jti', exp: 222222 } as never);
    mockBlacklist.mockResolvedValue(undefined);
  });

  it('should return ok even when no tokens are provided', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(mockBlacklist).not.toHaveBeenCalled();
  });

  it('should revoke both access and refresh tokens when provided', async () => {
    const res = await POST(req({ accessToken: 'a', refreshToken: 'r' }));
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockBlacklist).toHaveBeenCalledTimes(2);
    expect(mockBlacklist).toHaveBeenCalledWith('a-jti', 111111);
    expect(mockBlacklist).toHaveBeenCalledWith('r-jti', 222222);
  });

  it('should ignore invalid tokens and still return ok', async () => {
    mockVerifyAccess.mockRejectedValueOnce(new Error('invalid'));
    const res = await POST(req({ accessToken: 'bad', refreshToken: 'r' }));

    expect(res.status).toBe(200);
    expect(mockBlacklist).toHaveBeenCalledTimes(1);
  });
});
