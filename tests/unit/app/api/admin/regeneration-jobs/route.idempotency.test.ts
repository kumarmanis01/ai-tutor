/**
 * FILE OBJECTIVE:
 * - Unit tests for the idempotency / unique-constraint handling in the
 *   POST /api/admin/regeneration-jobs route.
 *   Covers: P2002/23505 returning the existing job; non-unique errors still
 *   returning 500; absence of the overly-broad 'unique'/'already exists' matches.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/regeneration-jobs/route.idempotency.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created — addresses PR review comments on unique-constraint handling
 */

import { POST } from '../../../../../../app/api/admin/regeneration-jobs/route';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({ requireAdminOrModerator: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/audit/log', () => ({ logAuditEvent: jest.fn() }));
jest.mock('@/regeneration/targetMap', () => ({
  getCandidatesFor: jest.fn(() => []),
}));

const mockRegenerationJob = {
  create: jest.fn(),
  findFirst: jest.fn(),
};
const mockContentSuggestion = {
  findUnique: jest.fn(),
  count: jest.fn(),
  findMany: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contentSuggestion: mockContentSuggestion,
    regenerationJob: mockRegenerationJob,
    $queryRawUnsafe: jest.fn(async () => [{ ok: 1 }]),
    $queryRaw: jest.fn(async () => []),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCEPTED_SUGGESTION = {
  id: 'suggestion-1',
  status: 'ACCEPTED',
  message: 'improve this',
  evidenceJson: {},
};

function makeRequest(body: object): Request {
  return { json: async () => body, headers: { get: () => null } } as unknown as Request;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/regeneration-jobs — unique-constraint / idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentSuggestion.findUnique.mockResolvedValue(ACCEPTED_SUGGESTION);
    mockContentSuggestion.count.mockResolvedValue(1);
    mockContentSuggestion.findMany.mockResolvedValue([ACCEPTED_SUGGESTION]);
  });

  it('returns the existing job when create throws a Prisma P2002 error', async () => {
    const existingJob = { id: 'job-existing', status: 'PENDING', targetType: 'LESSON', targetId: 'lesson-1' };
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

    mockRegenerationJob.create.mockRejectedValue(p2002);
    mockRegenerationJob.findFirst.mockResolvedValue(existingJob);

    const res = await POST(makeRequest({ suggestionId: 'suggestion-1', targetType: 'LESSON', targetId: 'lesson-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job).toEqual(existingJob);
    // Must look up by the full uniqueness key, not just suggestionId alone
    expect(mockRegenerationJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetType: 'LESSON', targetId: 'lesson-1' }),
      }),
    );
  });

  it('returns the existing job when create throws a postgres 23505 error', async () => {
    const existingJob = { id: 'job-existing-2', status: 'PENDING', targetType: 'TOPIC', targetId: 'topic-9' };
    const pg23505 = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });

    mockRegenerationJob.create.mockRejectedValue(pg23505);
    mockRegenerationJob.findFirst.mockResolvedValue(existingJob);

    const res = await POST(makeRequest({ suggestionId: 'suggestion-1', targetType: 'TOPIC', targetId: 'topic-9' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job).toEqual(existingJob);
  });

  it('returns 500 (not the existing job) when create throws a non-unique error', async () => {
    const dbError = Object.assign(new Error('connection timeout'), { code: 'P1001' });
    mockRegenerationJob.create.mockRejectedValue(dbError);

    const res = await POST(makeRequest({ suggestionId: 'suggestion-1', targetType: 'LESSON', targetId: 'lesson-2' }));
    expect(res.status).toBe(500);
    // Must NOT have attempted an idempotency lookup for a non-constraint error
    expect(mockRegenerationJob.findFirst).not.toHaveBeenCalled();
  });

  it('does NOT treat "already exists" message alone as a unique constraint (broad match removed)', async () => {
    // An error that previously would be misclassified by the broad lc.includes('already exists') check
    const unrelatedError = Object.assign(new Error('Table already exists in schema'), { code: 'P3001' });
    mockRegenerationJob.create.mockRejectedValue(unrelatedError);

    const res = await POST(makeRequest({ suggestionId: 'suggestion-1', targetType: 'LESSON', targetId: 'lesson-3' }));
    expect(res.status).toBe(500);
    expect(mockRegenerationJob.findFirst).not.toHaveBeenCalled();
  });

  it('does NOT treat a generic "unique" keyword in message alone as a unique constraint', async () => {
    // "unique" appears in the message but it is NOT a real DB unique violation
    const genericError = Object.assign(new Error('Value must be unique per user request'), { code: 'CUSTOM_CODE' });
    mockRegenerationJob.create.mockRejectedValue(genericError);

    const res = await POST(makeRequest({ suggestionId: 'suggestion-1', targetType: 'LESSON', targetId: 'lesson-4' }));
    expect(res.status).toBe(500);
    expect(mockRegenerationJob.findFirst).not.toHaveBeenCalled();
  });

  it('returns 500 when P2002 fires but no matching job is found for the original key', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockRegenerationJob.create.mockRejectedValue(p2002);
    // Simulate race: job was deleted between the failed create and the lookup
    mockRegenerationJob.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ suggestionId: 'suggestion-1', targetType: 'LESSON', targetId: 'lesson-5' }));
    // No matching job for the original key → treat as real error → 500
    expect(res.status).toBe(500);
  });
});
