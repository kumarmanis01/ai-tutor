/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/consent/validate/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created tests for consent validate route
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    consentRequest: {
      findUnique: jest.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/consent/validate/route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.consentRequest.findUnique as jest.MockedFunction<
  typeof prisma.consentRequest.findUnique
>;

describe('GET /api/v1/consent/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when token is missing', async () => {
    const res = await GET(new Request('http://localhost/api/v1/consent/validate'));
    expect(res.status).toBe(400);
  });

  it('should return 404 when token does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/v1/consent/validate?token=t1'));
    expect(res.status).toBe(404);
  });

  it('should return pending valid payload for active request', async () => {
    mockFindUnique.mockResolvedValue({
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      student: { id: 's1', name: 'Aarav', grade: 7, board: 'CBSE' },
      channel: 'WHATSAPP',
    } as never);

    const res = await GET(new Request('http://localhost/api/v1/consent/validate?token=t2'));
    const body = (await res.json()) as { valid: boolean; status: string; child: { id: string } };

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.status).toBe('PENDING');
    expect(body.child.id).toBe('s1');
  });

  it('should mark pending expired consent as EXPIRED', async () => {
    mockFindUnique.mockResolvedValue({
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 60_000),
      student: null,
      channel: 'EMAIL',
    } as never);

    const res = await GET(new Request('http://localhost/api/v1/consent/validate?token=t3'));
    const body = (await res.json()) as { valid: boolean; status: string };

    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.status).toBe('EXPIRED');
  });
});
