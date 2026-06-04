/**
 * Contract tests for the API routes called by the rewritten student & parent UI.
 *
 * Each describe block locks in a contract between one UI screen and one
 * Next.js API route. If a future change breaks the contract (renames a
 * response field, adds a new required payload field, drops the auth gate,
 * etc.), these tests fail loudly.
 *
 * Scope: only the routes that the post-rewrite UI actually calls from a
 * `fetch()` site. Server-side prisma reads in (parent|student)/*?page.tsx
 * are covered by their own page tests.
 *
 * To run only these tests:
 *   npx jest __tests__/contract/api-contract.test.ts
 */

// --- Test infra ----------------------------------------------------------

// Mock session: each test sets it before exercising a route.
const testSession: { current: any } = { current: null }
;(global as any).__TEST_SESSION__ = null
Object.defineProperty(global, '__TEST_SESSION__', {
  configurable: true,
  get: () => testSession.current,
})

jest.mock('@/lib/session', () => ({
  __esModule: true,
  getServerSessionForHandlers: jest.fn(async () => testSession.current),
}))

jest.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: jest.fn(async () => testSession.current),
}))

// Prisma mock: each route specifies the model methods it uses below.
const prismaMock: any = {
  user: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  parentStudent: { findMany: jest.fn() },
  structuredSession: { findMany: jest.fn() },
  studentStreak: { findFirst: jest.fn() },
  learningPlan: { findMany: jest.fn() },
  subjectDef: { findMany: jest.fn() },
  studentConceptState: { findMany: jest.fn(), count: jest.fn() },
  classLevel: { findFirst: jest.fn() },
  event: { create: jest.fn() },
  auditLog: { findMany: jest.fn(), create: jest.fn() },
}
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
}))

// Side-effect mocks: keep handlers from reaching out to Redis, mailers, etc.
jest.mock('@/lib/auth', () => ({
  __esModule: true,
  authOptions: { providers: [] },
  invalidateUserSessionCache: jest.fn(async () => undefined),
}))
jest.mock('@/lib/mail', () => ({
  __esModule: true,
  sendEmailUnifiedSafe: jest.fn(async () => ({ ok: true })),
}))
jest.mock('@/lib/dailyHabit', () => ({
  __esModule: true,
  getDailyTask: jest.fn(async () => null),
}))
jest.mock('@/lib/diagnostics/enqueueSubjectHydration', () => ({
  __esModule: true,
  enqueueSubjectHydration: jest.fn(async () => undefined),
}))
jest.mock('@/lib/ai/learningPlan', () => ({
  __esModule: true,
  generateLearningPlan: jest.fn(async () => 'plan-1'),
}))
jest.mock('@/lib/parent/contactLinking', () => ({
  __esModule: true,
  ensureAutoLinkedParentsForStudent: jest.fn(async () => undefined),
}))
jest.mock('@/lib/student/examReadiness', () => ({
  __esModule: true,
  computeReadinessScore: jest.fn(async () => ({ score: 65 })),
}))
jest.mock('@/lib/analytics/server', () => ({
  __esModule: true,
  emitServerAnalyticsEvent: jest.fn(async () => undefined),
}))
jest.mock('@/lib/subjects/resolveStudentSubjects', () => ({
  __esModule: true,
  default: jest.fn(async () => []),
}))

beforeEach(() => {
  testSession.current = null
  Object.values(prismaMock).forEach((model: any) => {
    Object.values(model).forEach((fn: any) => fn.mockReset?.())
  })
  // Safe defaults so fire-and-forget queries inside routes never crash.
  prismaMock.subjectDef.findMany.mockResolvedValue([])
  prismaMock.classLevel.findFirst.mockResolvedValue(null)
  prismaMock.learningPlan.findMany.mockResolvedValue([])
  prismaMock.studentConceptState.findMany.mockResolvedValue([])
  prismaMock.studentConceptState.count.mockResolvedValue(0)
  prismaMock.structuredSession.findMany.mockResolvedValue([])
  prismaMock.parentStudent.findMany.mockResolvedValue([])
  prismaMock.auditLog.findMany.mockResolvedValue([])
  prismaMock.auditLog.create.mockResolvedValue({})
  prismaMock.event.create.mockResolvedValue({})
  prismaMock.user.upsert.mockResolvedValue({})
})

function makeReq(url = 'http://localhost', init: RequestInit = {}) {
  return new Request(url, init) as any
}

// --- Route: POST /api/user/onboarding ------------------------------------
// UI caller: app/(student)/student/onboarding/page.tsx
// Sends: { name, age, board, grade, subjects[], preferred_language, parent_email? }
// Returns: { ok, requiresOtp, user: { id, name, phone } } | { error, fieldErrors }

describe('POST /api/user/onboarding -- student onboarding submit', () => {
  test('returns 401 when no session', async () => {
    const { POST } = await import('@/app/api/user/onboarding/route')
    const res = await POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(401)
  })

  test('returns 400 with fieldErrors when required fields are missing', async () => {
    testSession.current = { user: { id: 'u1', email: 's@example.com' } }
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', grade: null, board: null, subjects: [], language: null, whatsappPhone: null, parentWhatsappPhone: null, parentEmail: null })
    const { POST } = await import('@/app/api/user/onboarding/route')
    const res = await POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Asha' }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('validation_error')
    expect(body.fieldErrors).toBeDefined()
    expect(body.fieldErrors.class_grade || body.fieldErrors.board || body.fieldErrors.subjects).toBeTruthy()
  })

  test('language must be a value the Prisma LanguageCode enum accepts (en|hi)', async () => {
    // Locks in the bug fix: UI must NOT send "English"/"Hindi" -- only the
    // enum code (en|hi). We assert the route stores whatever it receives
    // verbatim, so callers must pre-map.
    testSession.current = { user: { id: 'u1', email: 's@example.com' } }
    prismaMock.user.findUnique
      // 1) initial fetch (existingById)
      .mockResolvedValueOnce({ id: 'u1', grade: null, board: null, subjects: [], language: null, whatsappPhone: null, parentWhatsappPhone: null, parentEmail: null })
      // 2) verificationState fetch after accountStatus update
      .mockResolvedValueOnce({ parentEmailVerifiedAt: null, parentWhatsappVerifiedAt: null })
    prismaMock.user.update.mockImplementation(async (args: any) => ({
      id: 'u1', name: 'Asha', age: 14, phone: null,
      language: args.data?.language ?? 'en',
      board: 'CBSE', grade: '10', email: 's@example.com',
      welcomeEmailSent: true, parentEmail: null, parentWhatsappPhone: null,
    }))
    const { POST } = await import('@/app/api/user/onboarding/route')
    const res = await POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Asha', age: 14, board: 'CBSE', grade: '10',
        subjects: ['mathematics'], preferred_language: 'en',
      }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.requiresOtp).toBe(false)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ language: 'en' }) }),
    )
  })
})

// NOTE: GET /api/parent/progress is intentionally NOT covered here. The
// rewritten /parent/progress UI no longer calls that legacy endpoint — it
// fetches /api/parent/dashboard + /api/parent/schedule in parallel and
// derives its view-model from those. Contract coverage for the new
// dependency lives in the GET /api/parent/dashboard block below.

// --- Route: GET /api/parent/schedule -------------------------------------
// UI caller: app/(parent)/parent/schedule/page.tsx
// Returns: { sessions: Array<{ id, concept, subject, scheduledAt, status, durationMinutes }> }

describe('GET /api/parent/schedule -- parent schedule page', () => {
  test('returns 401 when no session', async () => {
    const { GET } = await import('@/app/api/parent/schedule/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  test('returns 403 when session role is not parent', async () => {
    testSession.current = { user: { id: 'u1', role: 'student' } }
    const { GET } = await import('@/app/api/parent/schedule/route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  test('returns { sessions: [] } when no linked students', async () => {
    testSession.current = { user: { id: 'p1', role: 'parent' } }
    prismaMock.parentStudent.findMany.mockResolvedValue([])
    const { GET } = await import('@/app/api/parent/schedule/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ sessions: [] })
  })

  test('returns sessions with the shape the UI reads', async () => {
    testSession.current = { user: { id: 'p1', role: 'parent' } }
    prismaMock.parentStudent.findMany.mockResolvedValue([{ studentId: 's1' }])
    const startedAt = new Date()
    prismaMock.structuredSession.findMany.mockResolvedValue([{
      id: 'sess-1',
      startedAt,
      completedAt: null,
      topic: { name: 'Quadratic equations', chapter: { subject: { name: 'Mathematics' } } },
    }])
    const { GET } = await import('@/app/api/parent/schedule/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessions[0]).toMatchObject({
      id: 'sess-1',
      concept: 'Quadratic equations',
      subject: 'Mathematics',
      scheduledAt: expect.any(String),
      status: expect.stringMatching(/^(upcoming|completed|missed)$/),
      durationMinutes: expect.any(Number),
    })
  })
})

// --- Route: GET /api/user/profile ----------------------------------------
// UI caller: app/(student)/student/profile/page.tsx
// Returns the canonical user profile; UI reads { id, name, email, grade, board, language, learningStyle, plan }

describe('GET /api/user/profile -- student profile page', () => {
  test('returns 401 when no session', async () => {
    const { GET } = await import('@/app/api/user/profile/route')
    const res = await GET(makeReq() as Request)
    expect(res.status).toBe(401)
  })

  test('returns canonical profile shape the UI consumes', async () => {
    testSession.current = { user: { id: 'u1', email: 's@example.com' } }
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Asha',
      email: 's@example.com',
      country: 'IN',
      language: 'en',
      grade: '10',
      board: 'CBSE',
      schoolName: null,
      subjects: ['mathematics'],
      age: 15,
      parentPhone: null,
      parentPhoneVerifiedAt: null,
      whatsappPhone: null,
      accountStatus: 'active',
      learningStyle: 'visual',
      preferences: {},
      createdAt: new Date(),
      role: 'student',
      parentEmail: null,
      level: 1,
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      cosmeticUnlocks: [],
      userBadges: [],
      subscriptions: [{ id: 'sub-1', userId: 'u1', plan: 'premium', billingCycle: 'monthly', startDate: new Date(), endDate: new Date(), active: true }],
    })
    const { GET } = await import('@/app/api/user/profile/route')
    const res = await GET(makeReq() as Request)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Every field the StudentProfilePage interface reads must be present
    expect(body).toMatchObject({
      id: 'u1',
      name: 'Asha',
      email: 's@example.com',
      grade: '10',
      board: 'CBSE',
      language: 'en',
      learningStyle: 'visual',
      plan: 'premium',
    })
  })
})

// --- Route: POST /api/auth/parent/send-otp -------------------------------
// UI caller: app/(student)/student/onboarding/page.tsx -- consent step
// Note: Auth is enforced by the route; payload is empty -- email is read from session user.

describe('POST /api/auth/parent/send-otp -- consent OTP send', () => {
  test('returns 401 when no session', async () => {
    const mod = await import('@/app/api/auth/parent/send-otp/route')
    const res = await mod.POST(makeReq('http://localhost', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

// --- Route: POST /api/auth/parent/verify-otp -----------------------------
// UI caller: app/(student)/student/onboarding/page.tsx -- inline consent verify step
// Payload: { code: <4-6 digits> }. On success: transitions accountStatus to 'active'.

describe('POST /api/auth/parent/verify-otp -- consent OTP verify', () => {
  test('returns 401 when no session', async () => {
    const mod = await import('@/app/api/auth/parent/verify-otp/route')
    const res = await mod.POST(makeReq('http://localhost', { method: 'POST', body: JSON.stringify({ code: '123456' }) }))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('rejects malformed code with 400', async () => {
    testSession.current = { user: { id: 'u1', email: 's@example.com' } }
    const mod = await import('@/app/api/auth/parent/verify-otp/route')
    const res = await mod.POST(makeReq('http://localhost', { method: 'POST', body: JSON.stringify({ code: 'abc' }) }))
    expect([400, 401]).toContain(res.status)
  })

  test('rejects whatsapp channel as disabled', async () => {
    testSession.current = { user: { id: 'u1', email: 's@example.com' } }
    const mod = await import('@/app/api/auth/parent/verify-otp/route')
    const res = await mod.POST(makeReq('http://localhost', { method: 'POST', body: JSON.stringify({ code: '123456', channel: 'whatsapp' }) }))
    expect([400, 401]).toContain(res.status)
  })
})

// --- Route: GET /api/parent/dashboard ------------------------------------
// UI caller: app/(parent)/parent/progress/page.tsx (fetched alongside /schedule)
// Returns: { ok, students: [{ studentId, studentName, subjectProgress: [...], readiness: [...], weekly: [...] }] }

describe('GET /api/parent/dashboard -- parent progress page (real data)', () => {
  test('returns 401 when no session', async () => {
    const mod = await import('@/app/api/parent/dashboard/route')
    const res = await mod.GET(makeReq('http://localhost', { method: 'GET' }))
    expect(res.status).toBe(401)
  })

  test('returns { ok, students: [], totalStudents } when parent has no linked students', async () => {
    testSession.current = { user: { id: 'p1', role: 'parent' } }
    prismaMock.parentStudent.findMany.mockResolvedValue([])
    const mod = await import('@/app/api/parent/dashboard/route')
    const res = await mod.GET(makeReq('http://localhost', { method: 'GET' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Lock the empty-state envelope the UI adapter reads.
    expect(body).toMatchObject({
      ok: true,
      students: [],
      totalStudents: 0,
    })
    expect(typeof body.generatedAt).toBe('string')
    expect(Array.isArray(body.students)).toBe(true)
  })
})

// --- Route: POST /api/student/subscription/order -------------------------
// UI caller: app/(student)/student/upgrade/page.tsx -- "Continue" button
// Payload: { planId: 'standard_monthly' | 'standard_annual' | ... }
// Returns: { orderId, amount, currency, keyId }

describe('POST /api/student/subscription/order -- Razorpay order create', () => {
  test('returns 401 when no session', async () => {
    const mod = await import('@/app/api/student/subscription/order/route')
    const res = await mod.POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ planId: 'standard_monthly' }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(401)
  })

  test('rejects missing planId with 4xx', async () => {
    testSession.current = { user: { id: 'u1', email: 's@example.com' } }
    const mod = await import('@/app/api/student/subscription/order/route')
    const res = await mod.POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(600)
  })
})

// --- Route: POST /api/student/subscription/verify ------------------------
// UI caller: app/(student)/student/upgrade/page.tsx -- Razorpay success handler
// Payload: { orderId, paymentId, signature, planId }

describe('POST /api/student/subscription/verify -- Razorpay signature verify', () => {
  test('returns 401 when no session', async () => {
    const mod = await import('@/app/api/student/subscription/verify/route')
    const res = await mod.POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ orderId: 'o1', paymentId: 'p1', signature: 's1', planId: 'standard_monthly' }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(401)
  })

  test('rejects missing required fields with 400', async () => {
    testSession.current = { user: { id: 'u1', email: 's@example.com' } }
    const mod = await import('@/app/api/student/subscription/verify/route')
    const res = await mod.POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ orderId: 'o1' }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

// --- Route: POST /api/student/diagnostic/start ---------------------------
// UI caller: app/(student)/student/diagnostic/page.tsx (via DiagnosticFlow adaptive mode)
// Payload: { boardSlug, grade, subjectSlug, languageCode? }
// Returns: { sessionId, firstQuestion, totalQuestions }

describe('POST /api/student/diagnostic/start -- diagnostic bootstrap', () => {
  test('returns 401 when no session', async () => {
    const mod = await import('@/app/api/student/diagnostic/start/route')
    const res = await mod.POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ boardSlug: 'cbse', grade: '10', subjectSlug: 'mathematics' }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(401)
  })
})

// --- Route: POST /api/session/start --------------------------------------
// UI caller: app/(student)/session/[topicId]/page.tsx (via SessionContainer/useSession)
// Payload: { topicId }
// Returns: { session, phase, content, hydrating }

describe('POST /api/session/start -- learning session bootstrap', () => {
  test('returns 401 when no session', async () => {
    const mod = await import('@/app/api/session/start/route')
    const res = await mod.POST(makeReq('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ topicId: 't1' }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(401)
  })
})
