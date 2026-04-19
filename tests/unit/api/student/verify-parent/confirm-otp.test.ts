/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/verify-parent/confirm-otp
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/verify-parent/confirm-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | assistant | add unit tests for confirm-otp route
 */

describe('POST /api/student/verify-parent/confirm-otp', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    // Default mock for session to avoid loading next-auth/jose during module import
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
  })

  it('exports a POST handler', async () => {
    const route = await import('@/app/api/student/verify-parent/confirm-otp/route')
    expect(typeof route.POST).toBe('function')
  })

  it('verifies OTP, updates user and sends welcome notifications', async () => {
    // Prepare mocks
    const mockRedis = {
      get: jest.fn(async (key: string) => {
        // Return lock status only for lock key; OTP for otp key
        if (key === 'otp:parent:locked:stu-1') return null
        if (key === 'otp:parent:stu-1') return '123456'
        return null
      }),
      del: jest.fn(async (key: string) => 1),
      incr: jest.fn(async () => 1),
      expire: jest.fn(),
      setex: jest.fn(),
    }

    const mockUpdate = jest.fn(async (args: any) => ({ id: 'stu-1' }))
    const mockFindUnique = jest.fn(async (args: any) => ({ parentEmail: 'parent@example.com', parentPhone: '9000000000', name: 'Asha' }))

    const mockSendMailSafe = jest.fn(async () => undefined)
    const mockSendSms = jest.fn(async () => ({ ok: true }))

    // Mock modules before importing the route
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => mockRedis }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { user: { update: mockUpdate, findUnique: mockFindUnique } } }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: mockSendMailSafe }))
    jest.doMock('@/lib/sms', () => ({ sendSms: mockSendSms }))

    const route = await import('@/app/api/student/verify-parent/confirm-otp/route')

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: '123456' }),
    })

    const res: any = await route.POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.verified).toBe(true)

    expect(mockRedis.get).toHaveBeenCalledWith('otp:parent:stu-1')
    expect(mockRedis.del).toHaveBeenCalledWith('otp:parent:stu-1')
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 'stu-1' }, data: { parentVerifiedAt: expect.any(Date) } })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'stu-1' }, select: { parentEmail: true, parentPhone: true, name: true } })
    expect(mockSendMailSafe).toHaveBeenCalled()
    expect(mockSendSms).toHaveBeenCalled()
  })
})
