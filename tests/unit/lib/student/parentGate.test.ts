/**
 * FILE OBJECTIVE:
 * - Validate parent gate requirement and verification outcomes using DPDP_MINOR_AGE policy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/parentGate.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | copilot | add unit tests for DPDP_MINOR_AGE-based parent gate logic
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { checkParentGate } from '@/lib/student/parentGate';
import { prisma } from '@/lib/prisma';
import { DPDP_MINOR_AGE } from '@/lib/constants/age';

type MockedPrisma = {
  user: {
    findUnique: jest.Mock;
  };
};

const mockedPrisma = prisma as unknown as MockedPrisma;

describe('checkParentGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should require gate when age is below DPDP_MINOR_AGE and parent is unverified', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      age: DPDP_MINOR_AGE - 1,
      parentEmail: 'parent@example.com',
      parentVerifiedAt: null,
      requiresParentVerification: false,
    });

    const result = await checkParentGate('student-1');

    expect(result).toEqual({
      required: true,
      verified: false,
      parentEmail: 'parent@example.com',
    });
  });

  it('should not require gate when age is equal to DPDP_MINOR_AGE and override flag is false', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      age: DPDP_MINOR_AGE,
      parentEmail: null,
      parentVerifiedAt: null,
      requiresParentVerification: false,
    });

    const result = await checkParentGate('student-2');

    expect(result.required).toBe(false);
    expect(result.verified).toBe(false);
  });

  it('should not require gate when age is null and override flag is false', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      age: null,
      parentEmail: null,
      parentVerifiedAt: null,
      requiresParentVerification: false,
    });

    const result = await checkParentGate('student-3');

    expect(result.required).toBe(false);
    expect(result.verified).toBe(false);
  });

  it('should require gate when requiresParentVerification flag is true even if age is above threshold', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      age: DPDP_MINOR_AGE + 3,
      parentEmail: 'p@example.com',
      parentVerifiedAt: null,
      requiresParentVerification: true,
    });

    const result = await checkParentGate('student-4');

    expect(result.required).toBe(true);
    expect(result.verified).toBe(false);
  });

  it('should mark verified when parentVerifiedAt is present', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      age: DPDP_MINOR_AGE - 2,
      parentEmail: 'verified@example.com',
      parentVerifiedAt: new Date('2026-05-01T00:00:00Z'),
      requiresParentVerification: false,
    });

    const result = await checkParentGate('student-5');

    expect(result.required).toBe(true);
    expect(result.verified).toBe(true);
  });
});
