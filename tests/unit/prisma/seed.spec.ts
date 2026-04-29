/**
 * FILE OBJECTIVE:
 * - Unit tests for `prisma/seed.ts` ensuring idempotency and password validation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prisma/seed.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | created tests for seedSuperAdmin
 */

import { jest } from '@jest/globals';

const prismaMock: any = {
  adminUser: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  user: {
    create: jest.fn(),
  },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('seedSuperAdmin', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.INITIAL_SUPER_ADMIN_EMAIL;
    delete process.env.INITIAL_SUPER_ADMIN_NAME;
    delete process.env.INITIAL_SUPER_ADMIN_PASSWORD;
  });

  it('skips when a SUPER_ADMIN already exists', async () => {
    prismaMock.adminUser.findFirst.mockResolvedValue({ id: 'a1' });
    process.env.INITIAL_SUPER_ADMIN_EMAIL = 'admin@example.com';
    process.env.INITIAL_SUPER_ADMIN_NAME = 'Vikram';
    process.env.INITIAL_SUPER_ADMIN_PASSWORD = 'Aa1!aaaaaaaaaaaaa';

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const { seedSuperAdmin } = await import('../../../prisma/seed');
    await seedSuperAdmin();

    expect(prismaMock.adminUser.findFirst).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('ℹ️ Super Admin already exists. Skipping creation.');
    spy.mockRestore();
  });

  it('creates user and admin when none exists and password is valid', async () => {
    prismaMock.adminUser.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'u-1', email: 'admin@example.com' });
    prismaMock.adminUser.create.mockResolvedValue({ id: 'a-1' });

    process.env.INITIAL_SUPER_ADMIN_EMAIL = 'admin@example.com';
    process.env.INITIAL_SUPER_ADMIN_NAME = 'Vikram';
    process.env.INITIAL_SUPER_ADMIN_PASSWORD = 'Aa1!aaaaaaaaaaaaa';

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const { seedSuperAdmin } = await import('../../../prisma/seed');
    await seedSuperAdmin();

    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(prismaMock.adminUser.create).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('✅ Initial Super Admin created: admin@example.com');
    spy.mockRestore();
  });

  it('throws when password does not meet requirements', async () => {
    prismaMock.adminUser.findFirst.mockResolvedValue(null);
    process.env.INITIAL_SUPER_ADMIN_EMAIL = 'admin@example.com';
    process.env.INITIAL_SUPER_ADMIN_NAME = 'Vikram';
    process.env.INITIAL_SUPER_ADMIN_PASSWORD = 'short';

    const { seedSuperAdmin } = await import('../../../prisma/seed');
    await expect(seedSuperAdmin()).rejects.toThrow('initial_super_admin_password_policy_failed');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});
