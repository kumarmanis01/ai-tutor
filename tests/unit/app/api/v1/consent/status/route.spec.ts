/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/consent/status/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created tests for consent status route
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    consentRequest: {
      findUnique: jest.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/consent/status/route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.consentRequest.findUnique as jest.MockedFunction<
  typeof prisma.consentRequest.findUnique
>;

describe('GET /api/v1/consent/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when consent_token is missing', async () => {
    const res = await GET(new Request('http://localhost/api/v1/consent/status'));
    expect(res.status).toBe(400);
  });

  it('should return 404 when consent request is not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/v1/consent/status?consent_token=t1'));
    expect(res.status).toBe(404);
  });

  it('should return uppercase status for non-expired requests', async () => {
    mockFindUnique.mockResolvedValue({
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 60_000),
      parentPhone: '9876543210',
      parentEmail: null,
      channel: 'WHATSAPP',
      _count: { messageLogs: 2 },
      student: { name: 'Aarav', grade: 7, board: 'CBSE' },
    } as never);

    const res = await GET(new Request('http://localhost/api/v1/consent/status?consent_token=t2'));
    const body = (await res.json()) as { status: string; sentTo: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe('APPROVED');
    expect(body.sentTo.endsWith('3210')).toBe(true);
  });

  it('should map pending expired request to EXPIRED', async () => {
    mockFindUnique.mockResolvedValue({
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 60_000),
      parentPhone: null,
      parentEmail: 'parent@example.com',
      channel: 'EMAIL',
      _count: { messageLogs: 0 },
      student: null,
    } as never);

    const res = await GET(new Request('http://localhost/api/v1/consent/status?consent_token=t3'));
    const body = (await res.json()) as { status: string; sentTo: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe('EXPIRED');
    expect(body.sentTo.startsWith('p***@')).toBe(true);
  });
});
