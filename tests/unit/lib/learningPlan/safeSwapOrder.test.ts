/**
 * FILE OBJECTIVE:
 * - Unit tests for `lib/learningPlan/safeSwapOrder.ts` ensuring the helper
 *   invokes the DB update once and propagates errors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/learningPlan/safeSwapOrder.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add unit tests for safeSwapOrderInWeek
 */

import { safeSwapOrderInWeek } from '@/lib/learningPlan/safeSwapOrder';

describe('safeSwapOrderInWeek', () => {
  it('calls tx.$executeRaw once on happy path', async () => {
    const tx = { $executeRaw: jest.fn().mockResolvedValue(undefined) } as any;
    await expect(
      safeSwapOrderInWeek(tx, {
        planId: 'plan-1',
        weekNumber: 2,
        srcId: 'src-1',
        tgtId: 'tgt-1',
        srcOrder: 1,
        tgtOrder: 2,
      })
    ).resolves.toBeUndefined();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from the transaction and does not swallow them', async () => {
    const boom = new Error('db failure');
    const tx = { $executeRaw: jest.fn().mockRejectedValue(boom) } as any;
    await expect(
      safeSwapOrderInWeek(tx, {
        planId: 'plan-1',
        weekNumber: 2,
        srcId: 'src-1',
        tgtId: 'tgt-1',
        srcOrder: 1,
        tgtOrder: 2,
      })
    ).rejects.toThrow(boom);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
