/**
 * FILE OBJECTIVE:
 * - Unit tests for PATCH /api/student/learning-plan/[itemId] reorder/move actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/student/learningPlan.reorder.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | add reorder/move unit test stubs
 */

// Mock dependencies before importing the route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    learningPlanItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { PATCH } from '@/app/api/student/learning-plan/[itemId]/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

const mockPrisma = prisma as unknown as {
  learningPlanItem: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockGetSession = getServerSessionForHandlers as jest.Mock;

describe('PATCH /api/student/learning-plan/[itemId] (reorder & move)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = new Request('http://localhost/api/student/learning-plan/item-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'move', direction: 'next' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ itemId: 'item-1' }) } as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('swaps orderInWeek when moving to next item', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    mockPrisma.learningPlanItem.findFirst
      .mockResolvedValueOnce({ id: 'item-1', planId: 'plan-1', weekNumber: 1, orderInWeek: 1 }) // src
      .mockResolvedValueOnce({ id: 'item-2', planId: 'plan-1', weekNumber: 1, orderInWeek: 2 }); // tgt

    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const req = new Request('http://localhost/api/student/learning-plan/item-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'move', direction: 'next' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ itemId: 'item-1' }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 400 when no adjacent item to swap with', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    mockPrisma.learningPlanItem.findFirst
      .mockResolvedValueOnce({ id: 'item-1', planId: 'plan-1', weekNumber: 1, orderInWeek: 3 }) // src
      .mockResolvedValueOnce(null); // no adjacent

    const req = new Request('http://localhost/api/student/learning-plan/item-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'move', direction: 'next' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ itemId: 'item-1' }) } as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/No adjacent/i);
  });

  it('swaps orderInWeek when reordering two items in same week', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    mockPrisma.learningPlanItem.findFirst
      .mockResolvedValueOnce({ id: 'item-1', planId: 'plan-1', weekNumber: 2, orderInWeek: 1 })
      .mockResolvedValueOnce({ id: 'item-2', planId: 'plan-1', weekNumber: 2, orderInWeek: 2 });

    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const req = new Request('http://localhost/api/student/learning-plan/item-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reorder', targetItemId: 'item-2' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ itemId: 'item-1' }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
