/**
 * FILE OBJECTIVE:
 * - Unit tests for PATCH /api/student/learning-plan/[itemId] DEFERRED (skip-to-next) behaviour.
 *
 * LINKED UNIT TEST:
 * - tests/unit/student/learningPlan.deferred.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | add DEFERRED API unit test stubs
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    learningPlanItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
    logAPI: jest.fn(),
  },
}));

import { PATCH } from '@/app/api/student/learning-plan/[itemId]/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

const mockPrisma = prisma as unknown as {
  learningPlanItem: { findFirst: jest.Mock; update: jest.Mock };
};

const mockGetSession = getServerSessionForHandlers as jest.Mock;

describe('PATCH /api/student/learning-plan/[itemId] (DEFERRED)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = new Request('http://localhost/api/student/learning-plan/item-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DEFERRED' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ itemId: 'item-1' }) } as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('updates status to DEFERRED and sets deferredAt', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    mockPrisma.learningPlanItem.findFirst.mockResolvedValue({ id: 'item-1', studentId: 'user-1', planId: 'plan-1' });
    mockPrisma.learningPlanItem.update.mockResolvedValue({ id: 'item-1', status: 'DEFERRED', deferredAt: new Date().toISOString() });

    const req = new Request('http://localhost/api/student/learning-plan/item-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DEFERRED' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ itemId: 'item-1' }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockPrisma.learningPlanItem.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'item-1' }, data: expect.objectContaining({ status: 'DEFERRED', deferredAt: expect.anything() }) }));
  });
});
