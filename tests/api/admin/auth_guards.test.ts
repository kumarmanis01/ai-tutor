/**
 * FILE OBJECTIVE:
 * - Regression coverage for admin route auth guards added during the
 *   pre-release audit. Each previously-unguarded route is verified to
 *   return 401 when no session is present and 403 when the session role
 *   is not 'admin'. The guards run before any DB query, so this test
 *   does not need to mock prisma.
 *
 * LINKED UNIT TEST:
 * - tests/api/admin/auth_guards.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | add LINKED UNIT TEST + COPILOT + EDIT LOG sections.
 *
 * Routes covered:
 * - app/api/admin/topics/[id]/rollback
 * - app/api/admin/topics/[id]/generate
 * - app/api/admin/topics/[id]/approve
 * - app/api/admin/chapters/[id]/approve
 * - app/api/admin/chapters/[id]/reject
 * - app/api/admin/workers/stop
 * - app/api/admin/catalog/parse-image
 * - app/api/admin/content-central
 * - app/api/admin/content/pending
 * - app/api/admin/jobs/status
 * - app/api/admin/metrics/ltv-cac
 * - app/api/admin/metrics/ltv-cac/history
 * - app/api/admin/syllabi
 */

type Method = 'GET' | 'POST'

interface RouteCase {
  name: string
  importPath: string
  method: Method
  /** Function that builds the args passed to the handler. */
  buildArgs: () => unknown[]
}

const POST_CASES: RouteCase[] = [
  {
    name: 'topics/[id]/rollback',
    importPath: '../../../app/api/admin/topics/[id]/rollback/route',
    method: 'POST',
    buildArgs: () => [
      new Request('http://localhost/api/admin/topics/t1/rollback', { method: 'POST' }),
      { params: Promise.resolve({ id: 't1' }) },
    ],
  },
  {
    name: 'topics/[id]/generate',
    importPath: '../../../app/api/admin/topics/[id]/generate/route',
    method: 'POST',
    buildArgs: () => [
      new Request('http://localhost/api/admin/topics/t1/generate', { method: 'POST' }),
      { params: Promise.resolve({ id: 't1' }) },
    ],
  },
  {
    name: 'topics/[id]/approve',
    importPath: '../../../app/api/admin/topics/[id]/approve/route',
    method: 'POST',
    buildArgs: () => [
      new Request('http://localhost/api/admin/topics/t1/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 't1' }) },
    ],
  },
  {
    name: 'chapters/[id]/approve',
    importPath: '../../../app/api/admin/chapters/[id]/approve/route',
    method: 'POST',
    buildArgs: () => [
      new Request('http://localhost/api/admin/chapters/c1/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'c1' }) },
    ],
  },
  {
    name: 'chapters/[id]/reject',
    importPath: '../../../app/api/admin/chapters/[id]/reject/route',
    method: 'POST',
    buildArgs: () => [
      new Request('http://localhost/api/admin/chapters/c1/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'c1' }) },
    ],
  },
  {
    name: 'workers/stop',
    importPath: '../../../app/api/admin/workers/stop/route',
    method: 'POST',
    buildArgs: () => [
      new Request('http://localhost/api/admin/workers/stop', {
        method: 'POST',
        body: JSON.stringify({ id: 'w1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    ],
  },
  {
    name: 'catalog/parse-image',
    importPath: '../../../app/api/admin/catalog/parse-image/route',
    method: 'POST',
    buildArgs: () => [
      new Request('http://localhost/api/admin/catalog/parse-image', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=----test' },
      }),
    ],
  },
]

const GET_CASES: RouteCase[] = [
  {
    name: 'content-central',
    importPath: '../../../app/api/admin/content-central/route',
    method: 'GET',
    buildArgs: () => [new Request('http://localhost/api/admin/content-central')],
  },
  {
    name: 'content/pending',
    importPath: '../../../app/api/admin/content/pending/route',
    method: 'GET',
    buildArgs: () => [],
  },
  {
    name: 'jobs/status',
    importPath: '../../../app/api/admin/jobs/status/route',
    method: 'GET',
    buildArgs: () => [],
  },
  {
    name: 'metrics/ltv-cac',
    importPath: '../../../app/api/admin/metrics/ltv-cac/route',
    method: 'GET',
    buildArgs: () => [new Request('http://localhost/api/admin/metrics/ltv-cac')],
  },
  {
    name: 'metrics/ltv-cac/history',
    importPath: '../../../app/api/admin/metrics/ltv-cac/history/route',
    method: 'GET',
    buildArgs: () => [new Request('http://localhost/api/admin/metrics/ltv-cac/history?limit=5')],
  },
  {
    name: 'syllabi',
    importPath: '../../../app/api/admin/syllabi/route',
    method: 'GET',
    buildArgs: () => [],
  },
]

const ALL_CASES = [...POST_CASES, ...GET_CASES]

describe('admin route auth guards (pre-release audit regression suite)', () => {
  afterEach(() => {
    const g = globalThis as Record<string, unknown>
    delete g.__TEST_SESSION__
  })

  describe.each(ALL_CASES)('$name', ({ importPath, method, buildArgs }) => {
    test('returns 401 when there is no session', async () => {
      ;(globalThis as Record<string, unknown>).__TEST_SESSION__ = null
      const mod = await import(importPath)
      const handler = (mod as Record<string, (...args: unknown[]) => Promise<Response>>)[method]
      const res = await handler(...buildArgs())
      expect(res.status).toBe(401)
    })

    test('returns 403 when the session role is not admin', async () => {
      ;(globalThis as Record<string, unknown>).__TEST_SESSION__ = {
        user: { id: 'u-student', email: 's@example.com', role: 'student' },
      }
      const mod = await import(importPath)
      const handler = (mod as Record<string, (...args: unknown[]) => Promise<Response>>)[method]
      const res = await handler(...buildArgs())
      expect(res.status).toBe(403)
    })
  })
})
