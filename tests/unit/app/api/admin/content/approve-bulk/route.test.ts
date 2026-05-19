/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/admin/content/approve-bulk.
 * - Covers: auth guard, input validation, success path (updateMany + auditLog.createMany),
 *   and per-note cache key invalidation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content/approve-bulk/route.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created -- addresses PR review: cover forbidden, invalid payload, success path
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCacheDelPattern = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/cache', () => ({ cacheDelPattern: (...args: any[]) => mockCacheDelPattern(...args) }));

const mockTransaction = jest.fn();
const mockUserFindUnique = jest.fn();
const mockGeneratedTestFindMany = jest.fn();
const mockGeneratedTestUpdateMany = jest.fn();
const mockTopicNoteFindMany = jest.fn();
const mockTopicNoteUpdateMany = jest.fn();
const mockChapterDefUpdateMany = jest.fn();
const mockTopicDefUpdateMany = jest.fn();
const mockAuditLogCreateMany = jest.fn();

jest.doMock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    generatedTest: { findMany: mockGeneratedTestFindMany, updateMany: mockGeneratedTestUpdateMany },
    topicNote: { findMany: mockTopicNoteFindMany, updateMany: mockTopicNoteUpdateMany },
    chapterDef: { updateMany: mockChapterDefUpdateMany },
    topicDef: { updateMany: mockTopicDefUpdateMany },
    auditLog: { createMany: mockAuditLogCreateMany },
    $transaction: mockTransaction,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object): Request {
  return { json: async () => body } as unknown as Request;
}

function makeAdminSession() {
  return { user: { id: 'admin-1', role: 'admin' } };
}

async function loadRoute() {
  // Reset module registry so jest.doMock takes effect
  jest.resetModules();
  // Re-apply mocks after reset
  jest.doMock('@/lib/prisma', () => ({
    prisma: {
      user: { findUnique: mockUserFindUnique },
      generatedTest: { findMany: mockGeneratedTestFindMany, updateMany: mockGeneratedTestUpdateMany },
      topicNote: { findMany: mockTopicNoteFindMany, updateMany: mockTopicNoteUpdateMany },
      chapterDef: { updateMany: mockChapterDefUpdateMany },
      topicDef: { updateMany: mockTopicDefUpdateMany },
      auditLog: { createMany: mockAuditLogCreateMany },
      $transaction: mockTransaction,
    },
  }));
  const mod = await import('../../../../../../../app/api/admin/content/approve-bulk/route');
  return mod;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/content/approve-bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: transaction executes the callback synchronously
    mockTransaction.mockImplementation(async (fn: Function) => fn({
      generatedTest: { findMany: mockGeneratedTestFindMany, updateMany: mockGeneratedTestUpdateMany },
      topicNote: { findMany: mockTopicNoteFindMany, updateMany: mockTopicNoteUpdateMany },
      chapterDef: { updateMany: mockChapterDefUpdateMany },
      topicDef: { updateMany: mockTopicDefUpdateMany },
      auditLog: { createMany: mockAuditLogCreateMany },
    }));

    mockUserFindUnique.mockResolvedValue({ id: 'admin-1' });
    mockGeneratedTestFindMany.mockResolvedValue([{ topicId: 'topic-1' }]);
    mockGeneratedTestUpdateMany.mockResolvedValue({ count: 1 });
    mockTopicNoteFindMany.mockResolvedValue([{ id: 'note-1', topicId: 'topic-2' }]);
    mockTopicNoteUpdateMany.mockResolvedValue({ count: 1 });
    mockChapterDefUpdateMany.mockResolvedValue({ count: 1 });
    mockTopicDefUpdateMany.mockResolvedValue({ count: 1 });
    mockAuditLogCreateMany.mockResolvedValue({ count: 1 });
  });

  it('returns 403 for unauthenticated requests', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(null),
    }));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ items: [{ id: 'test-1', type: 'test', action: 'approve' }] }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 403 for non-admin users', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'user-1', role: 'student' } }),
    }));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ items: [{ id: 'test-1', type: 'test', action: 'approve' }] }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when items array is missing', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(makeAdminSession()),
    }));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ items: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/items array required/i);
  });

  it('returns 400 for an invalid content type', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(makeAdminSession()),
    }));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ items: [{ id: 'x', type: 'syllabus', action: 'approve' }] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid item type/i);
  });

  it('returns 400 for an invalid action value', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(makeAdminSession()),
    }));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ items: [{ id: 'test-1', type: 'test', action: 'delete' }] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid action/i);
  });

  it('calls updateMany and auditLog.createMany on success', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(makeAdminSession()),
    }));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({
      items: [
        { id: 'test-1', type: 'test', action: 'approve' },
        { id: 'test-2', type: 'test', action: 'approve' },
      ],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(mockGeneratedTestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'approved' } }),
    );
    expect(mockAuditLogCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ targetId: 'test-1', action: 'CONTENT_APPROVE' }),
          expect.objectContaining({ targetId: 'test-2', action: 'CONTENT_APPROVE' }),
        ]),
      }),
    );
  });

  it('invalidates per-note cache key (notes:topic-note:v1:<noteId>) on note approval', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(makeAdminSession()),
    }));
    const { POST } = await loadRoute();
    await POST(makeRequest({
      items: [{ id: 'note-1', type: 'note', action: 'approve' }],
    }));
    expect(mockCacheDelPattern).toHaveBeenCalledWith('notes:topic-note:v1:note-1');
  });

  it('invalidates topic-scoped note cache keys on note approval', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(makeAdminSession()),
    }));
    const { POST } = await loadRoute();
    await POST(makeRequest({
      items: [{ id: 'note-1', type: 'note', action: 'approve' }],
    }));
    expect(mockCacheDelPattern).toHaveBeenCalledWith('notes:for-topic:v1:topic-2:*');
    expect(mockCacheDelPattern).toHaveBeenCalledWith('notes:topic-content:v1:topic-2:*');
  });
});
