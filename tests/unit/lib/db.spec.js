/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * FILE OBJECTIVE:
 * - Unit test asserting that `lib/db.ts` re-exports the canonical Prisma client instance from `lib/prisma`.
 *
 * EDIT LOG:
 * - 2026-01-02T12:28:00Z | copilot | created (JS variant to avoid TS compiler issues)
 */

const { prisma: dbPrisma } = require('../../../lib/db');
const { prisma: directPrisma } = require('../../../lib/prisma');

describe('lib/db (JS)', () => {
  test('re-exports the same prisma instance as lib/prisma', () => {
    expect(dbPrisma).toBe(directPrisma);
    expect(dbPrisma).toHaveProperty('$connect');
    expect(typeof dbPrisma.$connect).toBe('function');
  });
});
