/**
 * FILE OBJECTIVE:
 * - Unit tests for fetchModerationInitialData to ensure missing-table errors are handled gracefully.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/moderation/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T15:50:00Z | copilot | add tests for missing-table handling
 */

// Mock modules that would pull in ESM-only dependencies (like `jose`) before importing the page module.
jest.mock('@/lib/admin/guards', () => ({ requireActiveAdmin: jest.fn(async () => ({ ok: true, adminUserId: 'admin-123' })) }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), info: jest.fn() } }));
jest.mock('@/lib/db', () => ({
  prisma: {
    content: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const { prisma } = require('@/lib/db');
const { fetchModerationInitialData } = require('@/app/admin/moderation/page');
const { logger } = require('@/lib/logger');

describe('fetchModerationInitialData', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns empty items and migrated=false when DB table is missing', async () => {
    const missingTableError = new Error('The table "public.Content" does not exist in the current database.');
    prisma.$transaction.mockRejectedValueOnce(missingTableError);

    const result = await fetchModerationInitialData('admin-123');

    expect(result).toEqual({ items: [], total: 0, migrated: false });
    expect(logger.error).toHaveBeenCalled();
  });

  it('rethrows unexpected errors after logging', async () => {
    const unexpected = new Error('connection timeout');
    prisma.$transaction.mockRejectedValueOnce(unexpected);

    await expect(fetchModerationInitialData('admin-123')).rejects.toThrow('connection timeout');
    expect(logger.error).toHaveBeenCalled();
  });
});
