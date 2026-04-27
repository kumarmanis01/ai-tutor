/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/v1/consent/resend denied-flow cooldown and contact-switch behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/resend.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created placeholder
 * - 2026-04-27T12:00:00Z | copilot | replace placeholder with behavioral tests for denied cooldown and contact switch
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    consentRequest: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    consentMessageLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/whatsapp/cloud.service', () => ({
  sendConsentRequest: jest.fn(),
}));

jest.mock('@/lib/mailer', () => ({
  sendMailSafe: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { POST } from '@/app/api/v1/consent/resend/route';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { sendMailSafe } from '@/lib/mailer';

const mockFindUnique = prisma.consentRequest.findUnique as jest.MockedFunction<
  typeof prisma.consentRequest.findUnique
>;
const mockUserFindUnique = prisma.user.findUnique as jest.MockedFunction<
  typeof prisma.user.findUnique
>;
const mockTransaction = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;
const mockMessageCreate = prisma.consentMessageLog.create as jest.MockedFunction<
  typeof prisma.consentMessageLog.create
>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

describe('POST /api/v1/consent/resend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when consent token is missing', async () => {
    const req = new Request('http://localhost/api/v1/consent/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns denied_device_cooldown for denied same-contact resends and stores 72h TTL', async () => {
    const redis = {
      ttl: jest.fn().mockResolvedValue(-1),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    mockGetRedis.mockReturnValue(redis as never);

    mockFindUnique.mockResolvedValue({
      id: 'cr-1',
      studentId: 'stu-1',
      status: 'DENIED',
      parentPhone: null,
      parentEmail: 'parent@example.com',
      messageLogs: [],
    } as never);

    const req = new Request('http://localhost/api/v1/consent/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': 'fingerprint-a',
      },
      body: JSON.stringify({
        consent_token: 'token-1',
      }),
    });

    const res = await POST(req);
    const data = (await res.json()) as { error?: string; retryAfterSeconds?: number };

    expect(res.status).toBe(429);
    expect(data.error).toBe('denied_device_cooldown');
    expect(data.retryAfterSeconds).toBe(72 * 60 * 60);
    expect(redis.setex).toHaveBeenCalled();
  });

  it('allows denied flow when contact is changed and creates replacement request', async () => {
    const redis = {
      ttl: jest.fn().mockResolvedValue(-1),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    mockGetRedis.mockReturnValue(redis as never);

    mockFindUnique.mockResolvedValue({
      id: 'cr-2',
      studentId: 'stu-2',
      status: 'DENIED',
      parentPhone: null,
      parentEmail: 'old-parent@example.com',
      messageLogs: [],
    } as never);

    mockUserFindUnique.mockResolvedValue({
      name: 'Aarav',
      grade: '7',
      board: 'CBSE',
    } as never);

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        consentRequest: {
          update: jest.fn().mockResolvedValue({ id: 'cr-2' }),
          create: jest.fn().mockResolvedValue({ id: 'cr-3' }),
        },
      };
      return callback(tx);
    });

    mockMessageCreate.mockResolvedValue({ id: 'log-1' } as never);

    const req = new Request('http://localhost/api/v1/consent/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': 'fingerprint-b',
      },
      body: JSON.stringify({
        consent_token: 'token-2',
        new_channel: 'email',
        new_contact: 'new-parent@example.com',
      }),
    });

    const res = await POST(req);
    const data = (await res.json()) as { ok?: boolean; replaced_request?: boolean; consent_token?: string };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.replaced_request).toBe(true);
    expect(typeof data.consent_token).toBe('string');
    expect(sendMailSafe).toHaveBeenCalled();
  });
});
