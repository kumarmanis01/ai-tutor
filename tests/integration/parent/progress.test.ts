/**
 * GROUP 4: Integration tests for parent actor APIs.
 * Covers parent auth gate, child data isolation, transcript protection,
 * and invite token lifecycle.
 * All external services mocked — no live DB or network calls.
 */

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------
const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue(redisMock),
}));

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  parentStudent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  structuredSession: {
    findMany: jest.fn(),
  },
  studentStreak: {
    findFirst: jest.fn(),
  },
  learningPlan: {
    findMany: jest.fn(),
  },
  subjectDef: {
    findMany: jest.fn(),
  },
  studentConceptState: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));
jest.mock('@/lib/student/examReadiness', () => ({
  computeReadinessScore: jest.fn().mockResolvedValue({ score: 0.75 }),
}));

// ---------------------------------------------------------------------------
// Module imports
// ---------------------------------------------------------------------------
import { getServerSession } from 'next-auth/next';
import { getServerSessionForHandlers } from '@/lib/session';

const mockGetServerSession = getServerSession as jest.Mock;
const mockGetServerSessionForHandlers = getServerSessionForHandlers as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue('OK');
  redisMock.del.mockResolvedValue(1);
  prismaMock.auditLog.create.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// Helper: make a mock Request object
// ---------------------------------------------------------------------------
function makeMockRequest(body?: unknown): Request {
  return {
    json: jest.fn().mockResolvedValue(body ?? {}),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// 1. Parent auth gate
// ---------------------------------------------------------------------------
describe('Parent auth gate — GET /api/parent/progress', () => {
  it('returns 403 when authenticated user has role=student (not parent)', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'student-1', role: 'student' },
    });

    // Dynamically import to pick up fresh mock
    const { GET } = await import('@/app/api/parent/progress/route');
    const req = makeMockRequest();
    const response = await GET(req);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/parent role required/i);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/parent/progress/route');
    const req = makeMockRequest();
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('returns 200 with children array for a parent session', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'parent-1', role: 'parent' },
    });
    prismaMock.parentStudent.findMany.mockResolvedValueOnce([
      { studentId: 'student-linked' },
    ]);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      name: 'Arjun',
      grade: '10',
      board: 'CBSE',
      subjects: ['Mathematics'],
    });
    prismaMock.studentStreak.findFirst.mockResolvedValueOnce({ current: 3, lastActive: new Date() });
    prismaMock.structuredSession.findMany.mockResolvedValueOnce([]);
    prismaMock.learningPlan.findMany.mockResolvedValueOnce([]);
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([
      { id: 'subj-math', name: 'Mathematics' },
    ]);
    prismaMock.studentConceptState.findMany.mockResolvedValue([]);
    prismaMock.studentConceptState.count.mockResolvedValueOnce(0);

    const { GET } = await import('@/app/api/parent/progress/route');
    const req = makeMockRequest();
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('children');
    expect(Array.isArray(body.children)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Child data isolation
// ---------------------------------------------------------------------------
describe('Child data isolation', () => {
  it('returns empty children array when parent is not linked to any student', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'parent-unlinked', role: 'parent' },
    });
    prismaMock.parentStudent.findMany.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/parent/progress/route');
    const req = makeMockRequest();
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.children).toHaveLength(0);
  });

  it('only returns data for linked children — not-linked student returns null (filtered out)', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'parent-2', role: 'parent' },
    });
    // Parent is linked to student-s1 only
    prismaMock.parentStudent.findMany.mockResolvedValueOnce([{ studentId: 'student-s1' }]);
    // student-s1 data
    prismaMock.user.findUnique.mockResolvedValueOnce({
      name: 'Priya',
      grade: '8',
      board: 'ICSE',
      subjects: [],
    });
    prismaMock.studentStreak.findFirst.mockResolvedValueOnce(null);
    prismaMock.structuredSession.findMany.mockResolvedValueOnce([]);
    prismaMock.learningPlan.findMany.mockResolvedValueOnce([]);
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([]);
    prismaMock.studentConceptState.count.mockResolvedValueOnce(0);

    const { GET } = await import('@/app/api/parent/progress/route');
    const req = makeMockRequest();
    const response = await GET(req);
    const body = await response.json();
    // Only s1 appears — s2 is never queried
    expect(body.children.map((c: any) => c.studentId)).toContain('student-s1');
    expect(body.children.map((c: any) => c.studentId)).not.toContain('student-s2');
  });
});

// ---------------------------------------------------------------------------
// 3. No transcript access
// ---------------------------------------------------------------------------
describe('No transcript access', () => {
  it('parent progress response does NOT include studentMessage or rawInput fields', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'parent-3', role: 'parent' },
    });
    prismaMock.parentStudent.findMany.mockResolvedValueOnce([{ studentId: 'student-s3' }]);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      name: 'Rahul',
      grade: '9',
      board: 'CBSE',
      subjects: ['Physics'],
    });
    prismaMock.studentStreak.findFirst.mockResolvedValueOnce({ current: 5, lastActive: new Date() });
    prismaMock.structuredSession.findMany.mockResolvedValueOnce([]);
    prismaMock.learningPlan.findMany.mockResolvedValueOnce([]);
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([{ id: 'subj-phys', name: 'Physics' }]);
    prismaMock.studentConceptState.findMany.mockResolvedValue([]);
    prismaMock.studentConceptState.count.mockResolvedValueOnce(0);

    const { GET } = await import('@/app/api/parent/progress/route');
    const req = makeMockRequest();
    const response = await GET(req);
    const body = await response.json();

    // Verify no chat transcript fields are present anywhere in the response
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('studentMessage');
    expect(bodyStr).not.toContain('rawInput');
    expect(bodyStr).not.toContain('rawTurn');
    expect(bodyStr).not.toContain('turnText');
  });
});

// ---------------------------------------------------------------------------
// 4. Invite token lifecycle
// ---------------------------------------------------------------------------
describe('Invite token lifecycle — POST /api/parent/link-child', () => {
  it('creates ParentStudent row when a valid invite token is used', async () => {
    const studentId = 'student-invite-1';
    const parentId = 'parent-invite-1';
    const token = 'abc123token';

    mockGetServerSessionForHandlers.mockResolvedValueOnce({
      user: { id: parentId },
    });
    // Redis has the token → studentId mapping
    redisMock.get.mockResolvedValueOnce(studentId);
    redisMock.del.mockResolvedValueOnce(1);
    prismaMock.parentStudent.findUnique.mockResolvedValueOnce(null); // no existing link
    prismaMock.parentStudent.create.mockResolvedValueOnce({
      id: 'ps-1',
      parentId,
      studentId,
      status: 'active',
    });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ role: 'user' }) // parent user (not yet promoted)
      .mockResolvedValueOnce({ name: 'Arjun' }); // student name
    prismaMock.user.update.mockResolvedValueOnce({ id: parentId, role: 'parent' });

    const { POST } = await import('@/app/api/parent/link-child/route');
    const req = {
      json: jest.fn().mockResolvedValue({ inviteToken: token }),
      headers: new Headers(),
    } as unknown as Request;

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.linked).toBe(true);
    expect(body.studentName).toBe('Arjun');

    // Token was burned (deleted from Redis)
    expect(redisMock.del).toHaveBeenCalledWith(`parent_invite:${token}`);
    // ParentStudent row was created
    expect(prismaMock.parentStudent.create).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when token does not exist in Redis (burned or expired)', async () => {
    const parentId = 'parent-invite-2';
    mockGetServerSessionForHandlers.mockResolvedValueOnce({
      user: { id: parentId },
    });
    // Token not found in Redis
    redisMock.get.mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/parent/link-child/route');
    const req = {
      json: jest.fn().mockResolvedValue({ inviteToken: 'expired-token' }),
      headers: new Headers(),
    } as unknown as Request;

    const response = await POST(req);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/invalid or has expired/i);
  });

  it('is idempotent when parent is already linked (active status)', async () => {
    const studentId = 'student-invite-2';
    const parentId = 'parent-invite-3';

    mockGetServerSessionForHandlers.mockResolvedValueOnce({
      user: { id: parentId },
    });
    redisMock.get.mockResolvedValueOnce(studentId);
    redisMock.del.mockResolvedValueOnce(1);
    // Existing active link
    prismaMock.parentStudent.findUnique.mockResolvedValueOnce({
      id: 'ps-existing',
      status: 'active',
    });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ role: 'parent' }) // already parent
      .mockResolvedValueOnce({ name: 'Maya' }); // student name

    const { POST } = await import('@/app/api/parent/link-child/route');
    const req = {
      json: jest.fn().mockResolvedValue({ inviteToken: 'valid-token' }),
      headers: new Headers(),
    } as unknown as Request;

    const response = await POST(req);
    expect(response.status).toBe(200);
    // No new row was created
    expect(prismaMock.parentStudent.create).not.toHaveBeenCalled();
  });

  it('returns 400 when inviteToken field is missing', async () => {
    mockGetServerSessionForHandlers.mockResolvedValueOnce({
      user: { id: 'parent-invite-4' },
    });

    const { POST } = await import('@/app/api/parent/link-child/route');
    const req = {
      json: jest.fn().mockResolvedValue({}), // no inviteToken
      headers: new Headers(),
    } as unknown as Request;

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
