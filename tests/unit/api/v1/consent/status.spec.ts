/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/v1/consent/status.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/status.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created placeholder
 * - 2026-04-24T12:00:00Z | copilot | TODO: real tests deferred to next phase
 */

jest.mock('@/lib/prisma', () => ({ prisma: { consentRequest: { findUnique: jest.fn() } } }));

import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/v1/consent/status/route';

describe('GET /api/v1/consent/status', () => {
  beforeEach(() => {
    (prisma.consentRequest.findUnique as jest.Mock).mockReset();
  });

  it('returns lowercase enum status when not expired', async () => {
    const token = 't-123';
    (prisma.consentRequest.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'cr-1',
      token,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60 * 1000),
      _count: { messageLogs: 0 },
      parentPhone: null,
      parentEmail: null,
      channel: 'EMAIL',
      student: { name: 'A', grade: '6', board: 'CBSE' },
    });

    const url = `https://example.com/api/v1/consent/status?consent_token=${token}`;
    const res = await GET(new Request(url));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe('pending');
    expect(data.child).toBeTruthy();
  });

  it('returns expired when request is past expiresAt even if enum is PENDING', async () => {
    const token = 't-456';
    (prisma.consentRequest.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'cr-2',
      token,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 60 * 1000),
      _count: { messageLogs: 0 },
      parentPhone: null,
      parentEmail: null,
      channel: 'EMAIL',
      student: null,
    });

    const url = `https://example.com/api/v1/consent/status?consent_token=${token}`;
    const res = await GET(new Request(url));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe('expired');
  });
});
