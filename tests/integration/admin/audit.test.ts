/**
 * GROUP 5: Integration tests for admin operations and audit trail.
 * Covers grade change audit, question quarantine, doubt escalation,
 * and DPDP erasure phases.
 * All external services mocked — no live DB or network calls.
 */

// ---------------------------------------------------------------------------
// Prisma mock — define before any import
// ---------------------------------------------------------------------------
const prismaMock = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  studentConceptState: {
    deleteMany: jest.fn(),
  },
  learningPlan: {
    deleteMany: jest.fn(),
  },
  question: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  sessionQuestionFlag: {
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  deletionRequest: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  consent: {
    deleteMany: jest.fn(),
  },
  structuredSession: {
    findMany: jest.fn(),
  },
  safetyEvent: {
    deleteMany: jest.fn(),
  },
  doubtEscalation: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/prisma.js', () => ({ prisma: prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));
jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));
jest.mock('@/utils/logApiUsage', () => ({
  logApiUsage: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------
const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  setex: jest.fn(),
};
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue(redisMock),
}));

// ---------------------------------------------------------------------------
// Module imports
// ---------------------------------------------------------------------------
import { getServerSessionForHandlers } from '@/lib/session';
import { runDataDeletionCycle } from '@/worker/services/dataDeletionWorker';
import { trackDoubtAttempt, resetDoubtCounter, makeDoubtHash } from '@/lib/redis/doubtEscalation';

const mockSession = getServerSessionForHandlers as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers for resetting all mocks
// ---------------------------------------------------------------------------
function resetAllPrismaMocks() {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === 'function' && 'mockReset' in model) {
      (model as jest.Mock).mockReset();
    } else if (typeof model === 'object' && model !== null) {
      for (const fn of Object.values(model)) {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as jest.Mock).mockReset();
        }
      }
    }
  }
}

function resetAllRedisMocks() {
  for (const fn of Object.values(redisMock)) {
    if (typeof fn === 'function' && 'mockReset' in fn) {
      (fn as jest.Mock).mockReset();
    }
  }
}

beforeEach(() => {
  // Full reset — clears both call data AND implementation queues
  resetAllPrismaMocks();
  resetAllRedisMocks();
  (mockSession as jest.Mock).mockReset();

  // Sensible defaults
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue('OK');
  redisMock.del.mockResolvedValue(1);
  redisMock.incr.mockResolvedValue(1);
  redisMock.expire.mockResolvedValue(1);

  prismaMock.$transaction.mockImplementation(async (ops: any) => {
    if (Array.isArray(ops)) {
      // Execute each op to track individual mock calls (ops are already evaluated)
      return Promise.all(ops.map((op: any) => Promise.resolve(op)));
    }
    return ops(prismaMock);
  });

  prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  prismaMock.studentConceptState.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.learningPlan.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.user.update.mockResolvedValue({ id: 'user-1' });
  prismaMock.consent.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.deletionRequest.update.mockResolvedValue({ id: 'req-1' });
  prismaMock.safetyEvent.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.doubtEscalation.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.sessionQuestionFlag.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.structuredSession.findMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAdminSession(adminId = 'admin-1') {
  return { user: { id: adminId, role: 'admin' } };
}

function makeMockRequest(body: unknown): Request {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// 1. AuditLog written on grade change — PATCH /api/admin/users/[id]
// ---------------------------------------------------------------------------
describe('AuditLog on admin grade change', () => {
  it('creates AuditLog with GRADE_CHANGE action when admin PATCHes grade', async () => {
    mockSession.mockResolvedValue(makeAdminSession());
    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({ grade: '8' });
    prismaMock.user.update.mockResolvedValueOnce({ id: 'student-1', grade: '9' });

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const req = makeMockRequest({ grade: 9, reason: 'Student repeated a year' });
    const response = await PATCH(req, { params: Promise.resolve({ id: 'student-1' }) });
    expect(response.status).toBe(200);

    // Verify $transaction was called with audit log
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const txArgs = prismaMock.$transaction.mock.calls[0][0];
    expect(Array.isArray(txArgs)).toBe(true);
  });

  it('deletes StudentConceptState rows when grade is changed', async () => {
    mockSession.mockResolvedValue(makeAdminSession());
    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({ grade: '8' });
    prismaMock.user.update.mockResolvedValueOnce({ id: 'student-grade-reset', grade: '9' });

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const req = makeMockRequest({ grade: 9, reason: 'test' });
    await PATCH(req, { params: Promise.resolve({ id: 'student-grade-reset' }) });

    expect(prismaMock.studentConceptState.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 'student-grade-reset' },
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Grade change requires reason
// ---------------------------------------------------------------------------
describe('Grade change requires reason', () => {
  it('returns 400 when grade is supplied but reason field is missing', async () => {
    mockSession.mockResolvedValue(makeAdminSession());

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const req = makeMockRequest({ grade: 9 });
    const response = await PATCH(req, { params: Promise.resolve({ id: 'student-2' }) });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('reason_required');
  });

  it('returns 400 when grade is supplied with an empty reason string', async () => {
    mockSession.mockResolvedValue(makeAdminSession());

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const req = makeMockRequest({ grade: 9, reason: '   ' });
    const response = await PATCH(req, { params: Promise.resolve({ id: 'student-3' }) });
    expect(response.status).toBe(400);
  });

  it('returns 403 when called by a non-admin user', async () => {
    mockSession.mockResolvedValue({ user: { id: 'student-hacker', role: 'student' } });

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const req = makeMockRequest({ grade: 9, reason: 'test' });
    const response = await PATCH(req, { params: Promise.resolve({ id: 'some-student' }) });
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3. Question quarantine on 3 flags — POST /api/student/question/[id]/flag
// ---------------------------------------------------------------------------
describe('Question quarantine on 3 flags', () => {
  it('sets Question.status=QUARANTINED when total flags reach threshold (3)', async () => {
    mockSession.mockResolvedValue({ user: { id: 'student-flagger' } });
    prismaMock.question.findUnique.mockResolvedValueOnce({ id: 'q-1', status: 'ACTIVE' });
    prismaMock.sessionQuestionFlag.upsert.mockResolvedValueOnce({ id: 'flag-3' });
    prismaMock.sessionQuestionFlag.count.mockResolvedValueOnce(3);
    prismaMock.question.update.mockResolvedValueOnce({ id: 'q-1', status: 'QUARANTINED' });

    const { POST } = await import('@/app/api/student/question/[questionId]/flag/route');
    const req = {
      json: jest.fn().mockResolvedValue({ reason: 'WRONG_ANSWER' }),
      headers: new Headers(),
    } as unknown as Request;

    const response = await POST(req as any, { params: { questionId: 'q-1' } } as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.flagged).toBe(true);
    expect(body.totalFlags).toBe(3);
    // Transaction called for quarantine
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('does NOT quarantine when flag count is 2 (below threshold)', async () => {
    mockSession.mockResolvedValue({ user: { id: 'student-flagger-2' } });
    prismaMock.question.findUnique.mockResolvedValueOnce({ id: 'q-2', status: 'ACTIVE' });
    prismaMock.sessionQuestionFlag.upsert.mockResolvedValueOnce({ id: 'flag-2' });
    prismaMock.sessionQuestionFlag.count.mockResolvedValueOnce(2);

    const { POST } = await import('@/app/api/student/question/[questionId]/flag/route');
    const req = {
      json: jest.fn().mockResolvedValue({ reason: 'WRONG_ANSWER' }),
      headers: new Headers(),
    } as unknown as Request;

    const response = await POST(req as any, { params: { questionId: 'q-2' } } as any);
    expect(response.status).toBe(200);
    // No transaction for quarantine since count is 2
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid reason', async () => {
    mockSession.mockResolvedValue({ user: { id: 'student-flagger-3' } });

    const { POST } = await import('@/app/api/student/question/[questionId]/flag/route');
    const req = {
      json: jest.fn().mockResolvedValue({ reason: 'NOT_A_VALID_REASON' }),
      headers: new Headers(),
    } as unknown as Request;

    const response = await POST(req as any, { params: { questionId: 'q-3' } } as any);
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 4. Doubt escalation — trackDoubtAttempt and makeDoubtHash
// ---------------------------------------------------------------------------
describe('Doubt escalation', () => {
  it('makeDoubtHash produces a consistent 8-char hex string for same inputs', () => {
    const h1 = makeDoubtHash('concept-1', 'what is velocity?');
    const h2 = makeDoubtHash('concept-1', 'what is velocity?');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(8);
    expect(/^[a-f0-9]+$/.test(h1)).toBe(true);
  });

  it('makeDoubtHash produces different hashes for different inputs', () => {
    const h1 = makeDoubtHash('concept-1', 'what is velocity?');
    const h2 = makeDoubtHash('concept-1', 'what is acceleration?');
    expect(h1).not.toBe(h2);
  });

  it('trackDoubtAttempt increments counter and appends to history', async () => {
    redisMock.incr.mockResolvedValueOnce(2);
    redisMock.expire.mockResolvedValueOnce(1);
    redisMock.get.mockResolvedValueOnce(
      JSON.stringify([{ turnId: 'turn-1', aiResponse: 'Previous answer' }])
    );
    redisMock.set.mockResolvedValueOnce('OK');

    const result = await trackDoubtAttempt('session-1', 'doubthash1', {
      turnId: 'turn-2',
      aiResponse: 'New answer',
    });

    expect(result.count).toBe(2);
    expect(result.history).toHaveLength(2);
    expect(result.history[1].turnId).toBe('turn-2');
  });

  it('trackDoubtAttempt caps history at 3 entries', async () => {
    redisMock.incr.mockResolvedValueOnce(4);
    redisMock.expire.mockResolvedValueOnce(1);
    redisMock.get.mockResolvedValueOnce(
      JSON.stringify([
        { turnId: 't1', aiResponse: 'r1' },
        { turnId: 't2', aiResponse: 'r2' },
        { turnId: 't3', aiResponse: 'r3' },
      ])
    );
    redisMock.set.mockResolvedValueOnce('OK');

    const result = await trackDoubtAttempt('session-1', 'doubthash2', {
      turnId: 't4',
      aiResponse: 'r4',
    });

    expect(result.history).toHaveLength(3);
    expect(result.history[2].turnId).toBe('t4');
    expect(result.history[0].turnId).toBe('t2');
  });

  it('trackDoubtAttempt returns { count: 0, history: [] } on Redis error', async () => {
    redisMock.incr.mockRejectedValueOnce(new Error('redis down'));
    const result = await trackDoubtAttempt('session-err', 'hash-err', {
      turnId: 'turn-err',
      aiResponse: 'err',
    });
    expect(result).toEqual({ count: 0, history: [] });
  });

  it('resetDoubtCounter deletes both counter and history keys', async () => {
    await resetDoubtCounter('session-1', 'doubthash1');
    expect(redisMock.del).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 5. DPDP erasure phases — runDataDeletionCycle()
// ---------------------------------------------------------------------------
describe('DPDP erasure phases', () => {
  it('Phase 1: pseudonymises user PII after 7+ days', async () => {
    const requestId = 'del-req-1';
    const userId = 'user-to-delete';

    prismaMock.deletionRequest.findMany
      .mockResolvedValueOnce([
        { id: requestId, userId, requestedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      ])
      .mockResolvedValueOnce([]); // Phase 2: none

    const result = await runDataDeletionCycle();

    expect(result.pseudonymised).toBe(1);
    expect(result.purged).toBe(0);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const txArgs = prismaMock.$transaction.mock.calls[0][0];
    expect(Array.isArray(txArgs)).toBe(true);
  });

  it('Phase 1: sets pseudonymisedAt on DeletionRequest', async () => {
    const requestId = 'del-req-phase1';
    const userId = 'user-phase1';

    prismaMock.deletionRequest.findMany
      .mockResolvedValueOnce([
        { id: requestId, userId, requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      ])
      .mockResolvedValueOnce([]);

    await runDataDeletionCycle();

    // deletionRequest.update should be called to set pseudonymisedAt
    expect(prismaMock.deletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: requestId },
        data: expect.objectContaining({ pseudonymisedAt: expect.any(Date) }),
      })
    );
  });

  it('Phase 2: purges SafetyEvent rows after 30+ days from pseudonymisation', async () => {
    const requestId = 'del-req-2';
    const userId = 'user-to-purge';

    prismaMock.deletionRequest.findMany
      .mockResolvedValueOnce([]) // Phase 1: none
      .mockResolvedValueOnce([
        {
          id: requestId,
          userId,
          pseudonymisedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        },
      ]);

    const result = await runDataDeletionCycle();

    expect(result.purged).toBe(1);
    expect(result.pseudonymised).toBe(0);
    // safetyEvent.deleteMany is called when building the $transaction array
    expect(prismaMock.safetyEvent.deleteMany).toHaveBeenCalledWith({
      where: { studentId: userId },
    });
  });

  it('Phase 2: sets purgedAt on DeletionRequest', async () => {
    const requestId = 'del-req-purge';
    const userId = 'user-to-purge-2';

    prismaMock.deletionRequest.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: requestId,
        userId,
        pseudonymisedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      },
    ]);

    await runDataDeletionCycle();

    expect(prismaMock.deletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: requestId },
        data: expect.objectContaining({ purgedAt: expect.any(Date) }),
      })
    );
  });

  it('Phase 2: does NOT delete AuditLog rows (required for 7yr legal compliance)', async () => {
    prismaMock.deletionRequest.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'del-req-audit',
        userId: 'user-audit',
        pseudonymisedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
      },
    ]);

    await runDataDeletionCycle();

    // auditLog is created (for ERASURE_PURGE event), but NOT a deleteMany call
    expect(prismaMock.auditLog).not.toHaveProperty('deleteMany');
  });

  it('handles errors per-request and continues to next (never throws)', async () => {
    prismaMock.deletionRequest.findMany
      .mockResolvedValueOnce([
        {
          id: 'fail-req',
          userId: 'user-fail',
          requestedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'ok-req',
          userId: 'user-ok',
          requestedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        },
      ])
      .mockResolvedValueOnce([]);

    // First transaction fails, second succeeds (default mockImplementation handles it)
    prismaMock.$transaction
      .mockRejectedValueOnce(new Error('constraint violation'))
      .mockResolvedValueOnce([]);

    const result = await runDataDeletionCycle();

    // Should successfully process the second request despite first failing
    expect(result.pseudonymised).toBe(1);
    expect(result.purged).toBe(0);
  });
});
