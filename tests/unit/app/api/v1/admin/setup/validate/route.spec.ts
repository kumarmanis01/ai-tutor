/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/admin/setup/validate/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin setup validate tests
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: jest.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/admin/setup/validate/route';
import { prisma } from '@/lib/prisma';

const findUnique = (prisma as any).adminUser.findUnique as jest.Mock;

describe('admin setup validate', () => {
  it('returns 400 when token missing', async () => {
    const res = await GET(new Request('http://localhost/api/v1/admin/setup/validate'));
    expect(res.status).toBe(400);
  });

  it('returns valid true when token is active', async () => {
    findUnique.mockResolvedValue({
      status: 'INVITED',
      role: 'SUPPORT_ADMIN',
      inviteExpiresAt: new Date(Date.now() + 60000),
      user: { name: 'Admin', email: 'admin@corp.com' },
    });
    const res = await GET(new Request('http://localhost/api/v1/admin/setup/validate?token=abc'));
    expect(res.status).toBe(200);
  });
});
