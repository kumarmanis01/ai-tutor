/**
 * FILE OBJECTIVE:
 * - Unit tests for the newsletter subscribe API route.
 *
 * LINKED UNIT TEST: this file is the test
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 newsletter subscribe route
 * - 2026-04-27T10:50:00Z | copilot | make rate-limit test deterministic and assert no DB write on 429
 */
import { POST } from '@/app/api/v1/newsletter/subscribe/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

var mockAllow: jest.Mock;

// Mocks
jest.mock('@/lib/db', () => ({
  prisma: {
    newsletterSubscriber: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

jest.mock('@/lib/alerts/redisRateLimiter', () => {
  mockAllow = jest.fn().mockResolvedValue(true);
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      allow: mockAllow,
    })),
  };
});

const makeRequest = (body: unknown, ip = '1.2.3.4'): NextRequest => {
  return new NextRequest('http://localhost/api/v1/newsletter/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
};

describe('POST /api/v1/newsletter/subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllow.mockReset();
    mockAllow.mockResolvedValue(true);
  });

  it('should return 200 for valid request', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com', consentGiven: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('should return 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', consentGiven: true }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when consentGiven is false', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com', consentGiven: false }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when consentGiven is missing', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when body is invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/v1/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: 'not-json{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('INVALID_JSON');
  });

  it('should return 429 when rate limited', async () => {
    mockAllow.mockResolvedValueOnce(false);

    const res = await POST(makeRequest({ email: 'test2@example.com', consentGiven: true }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe('RATE_LIMITED');
    expect(prisma.newsletterSubscriber.upsert).not.toHaveBeenCalled();
  });

  it('should return 500 when DB throws', async () => {
    (prisma.newsletterSubscriber.upsert as jest.Mock).mockRejectedValueOnce(
      new Error('DB error')
    );
    const res = await POST(makeRequest({ email: 'fail@example.com', consentGiven: true }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.code).toBe('INTERNAL_ERROR');
  });
});
