/**
 * Unit tests for GET /api/user/profile
 * Ensures student-specific fields (including `schoolName`) are returned.
 */

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns schoolName when present on user row', async () => {
    const savedUser = {
      id: 'u1',
      email: 'u@example.com',
      name: 'Test User',
      grade: '10',
      board: 'cbse',
      schoolName: 'Test School',
      subjects: ['mathematics'],
      age: 15,
      parentPhone: null,
      parentPhoneVerifiedAt: null,
      subscriptions: [],
      userBadges: [],
      country: 'IN',
      language: 'en',
      createdAt: null,
      role: 'student',
    }

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { email: 'u@example.com' } }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { user: { findUnique: async () => savedUser } } }))

    const { GET } = await import('@/app/api/user/profile/route')
    const req = new Request('http://localhost', { method: 'GET' })
    const res: any = await GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.schoolName).toBe('Test School')
  })

  it('returns null schoolName when missing on user row', async () => {
    const savedUser = {
      id: 'u2',
      email: 'no-school@example.com',
      name: 'No School',
      grade: null,
      board: null,
      schoolName: null,
      subjects: [],
      age: null,
      parentPhone: null,
      parentPhoneVerifiedAt: null,
      subscriptions: [],
      userBadges: [],
      country: 'IN',
      language: 'en',
      createdAt: null,
      role: 'student',
    }

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { email: 'no-school@example.com' } }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { user: { findUnique: async () => savedUser } } }))

    const { GET } = await import('@/app/api/user/profile/route')
    const req = new Request('http://localhost', { method: 'GET' })
    const res: any = await GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.schoolName).toBeNull()
  })
})
