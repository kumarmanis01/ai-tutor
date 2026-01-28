/**
 * FILE OBJECTIVE:
 * - Unit test asserting that `lib/db.ts` re-exports the canonical Prisma client instance from `lib/prisma`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/db.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - docs/TESTING.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-02T12:20:00Z | copilot | created
 */

import { prisma as dbPrisma } from '@/lib/db';
import { prisma as directPrisma } from '@/lib/prisma';

describe('lib/db', () => {
  it('re-exports the same prisma instance as lib/prisma', () => {
    expect(dbPrisma).toBe(directPrisma);
    expect(dbPrisma).toHaveProperty('$connect');
    expect(typeof dbPrisma.$connect).toBe('function');
  });
});
