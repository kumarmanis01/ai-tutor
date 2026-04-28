/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/auth/google/route.ts — POST /api/v1/auth/google.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B2.2 auth route tests
 */

// ── Phase-2 TODO ──────────────────────────────────────────────────────────────
// Integration tests for this route require running Next.js test server + Redis.
// Tracked in post_launch_backlog.md — "B2.2 /api/v1/auth/google integration tests".

jest.mock('@/lib/auth/google.service', () => ({
  verifyGoogleToken: jest.fn(),
  findOrCreateUser: jest.fn(),
}));

jest.mock('@/lib/auth/token.service', () => ({
  generateTokenPair: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(),
}));

import { POST } from '@/app/api/v1/auth/google/route';
import { verifyGoogleToken, findOrCreateUser } from '@/lib/auth/google.service';
import { generateTokenPair } from '@/lib/auth/token.service';
import { getRedis } from '@/lib/redis';
import { NextRequest } from 'next/server';

const mockVerifyGoogleToken = verifyGoogleToken as jest.MockedFunction<typeof verifyGoogleToken>;
const mockFindOrCreateUser = findOrCreateUser as jest.MockedFunction<typeof findOrCreateUser>;
const mockGenerateTokenPair = generateTokenPair as jest.MockedFunction<typeof generateTokenPair>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

function buildRequest(body: unknown, ip = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/auth/google', () => {
  const mockRedis = {
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Redis rate limit: under limit by default
    mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(60);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('should return 400 when idToken is missing', async () => {
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when idToken is not a string', async () => {
    const req = buildRequest({ idToken: 12345 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('should return 200 with token pair for valid Google token', async () => {
    mockVerifyGoogleToken.mockResolvedValue({
      sub: 'google-123',
      email: 'user@example.com',
      name: 'Test User',
      picture: null,
      email_verified: true,
    });
    mockFindOrCreateUser.mockResolvedValue({
      userId: 'user-abc',
      email: 'user@example.com',
      name: 'Test User',
      isNewUser: false,
    });
    mockGenerateTokenPair.mockResolvedValue({
      accessToken: 'access.token.here',
      refreshToken: 'refresh.token.here',
    });

    const req = buildRequest({ idToken: 'valid-google-id-token' });
    const res = await POST(req);
    const body = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      isNewUser: boolean;
    };

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('accessToken', 'access.token.here');
    expect(body).toHaveProperty('refreshToken', 'refresh.token.here');
    expect(body).toHaveProperty('isNewUser', false);
  });

  // ── Rate limit ─────────────────────────────────────────────────────────────

  it('should return 429 when rate limit is exceeded', async () => {
    mockRedis.incr.mockResolvedValue(11); // over 10 req/min limit
    const req = buildRequest({ idToken: 'some-token' });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('should return 401 when Google token verification fails', async () => {
    mockVerifyGoogleToken.mockRejectedValue(new Error('Invalid token'));
    const req = buildRequest({ idToken: 'bad-token' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
