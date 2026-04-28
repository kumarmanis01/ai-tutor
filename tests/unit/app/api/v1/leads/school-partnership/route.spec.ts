/**
 * FILE OBJECTIVE:
 * - Unit tests for the school partnership lead API route.
 *
 * LINKED UNIT TEST: this file is the test
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 school-partnership route
 * - 2026-04-27T10:50:00Z | copilot | add deterministic 429 rate-limit test and no-write assertion
 */
import { POST } from '@/app/api/v1/leads/school-partnership/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

var mockAllow: jest.Mock;

jest.mock('@/lib/db', () => ({
  prisma: {
    schoolLead: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

jest.mock('@/lib/alerts/redisRateLimiter', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    mockAllow = jest.fn().mockResolvedValue(true);
    return {
      allow: mockAllow,
    };
  }),
}));

const makeRequest = (body: unknown): NextRequest =>
  new NextRequest('http://localhost/api/v1/leads/school-partnership', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });

const VALID_BODY = {
  name: 'Amit Singh',
  schoolName: 'Delhi Public School',
  email: 'amit@dps.ac.in',
  phone: '9876543210',
  message: 'Interested in bulk licensing.',
};

describe('POST /api/v1/leads/school-partnership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllow.mockReset();
    mockAllow.mockResolvedValue(true);
  });

  it('should return 200 for valid request', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('should return 200 without optional fields', async () => {
    const res = await POST(makeRequest({ name: 'Ravi', schoolName: 'ABC School', email: 'ravi@abc.com' }));
    expect(res.status).toBe(200);
  });

  it('should return 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: 'bad-email' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when phone is not 10 digits', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, phone: '123' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when name is too short', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, name: 'A' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/v1/leads/school-partnership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: '{bad json}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_JSON');
  });

  it('should return 429 when rate limited', async () => {
    mockAllow.mockResolvedValueOnce(false);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('RATE_LIMITED');
    expect(prisma.schoolLead.create).not.toHaveBeenCalled();
  });

  it('should return 500 when DB throws', async () => {
    (prisma.schoolLead.create as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('INTERNAL_ERROR');
  });
});
