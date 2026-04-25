/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/admin/auth/login/start/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin login start tests
 */

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

jest.mock('@/lib/auth/token.service', () => ({
  generateTokenPair: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    adminTrustedDevice: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/mailer', () => ({ sendMailSafe: jest.fn() }));

import bcrypt from 'bcryptjs';
import { POST } from '@/app/api/v1/admin/auth/login/start/route';
import { prisma } from '@/lib/prisma';

const mockCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
const prismaMock = prisma as unknown as {
  adminUser: { findFirst: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  adminTrustedDevice: { findUnique: jest.Mock };
};

describe('admin login start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 for missing credentials', async () => {
    const res = await POST(new Request('http://localhost/api/v1/admin/auth/login/start', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(400);
  });

  it('should return 401 for invalid credentials', async () => {
    prismaMock.adminUser.findFirst.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
      passwordHash: 'hash',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      user: { id: 'u1', email: 'admin@corp.com' },
    });
    mockCompare.mockResolvedValue(false);

    const res = await POST(
      new Request('http://localhost/api/v1/admin/auth/login/start', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@corp.com', password: 'wrong' }),
      })
    );

    expect(res.status).toBe(401);
  });
});
