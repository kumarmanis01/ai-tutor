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
 * - 2026-05-11T00:00:00Z | copilot | update tests for channel-specific OTP verification and per-channel status response
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
    const mockUpdate = jest.fn(async () => ({ id: 'stu-1' }))
    const mockFindUnique = jest.fn(async () => ({
      parentEmail: 'parent@example.com',
      parentPhone: '9000000000',
      whatsappPhone: '9000000000',
      name: 'Asha',
    }))
    const mockFindFirst = jest.fn(async () => ({ id: 'otp-1' }))
    const mockOtpUpdate = jest.fn(async () => ({ id: 'otp-1' }))
    const mockTxn = jest.fn(async (ops: unknown[]) => ops)
    const mockOtpFindMany = jest.fn(async () => [{ phone: 'email:cGFyZW50QGV4YW1wbGUu' }])

    const mockSendMailSafe = jest.fn(async () => undefined)
    const mockSendSms = jest.fn(async () => ({ ok: true }))

    // Mock modules before importing the route
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { update: mockUpdate, findUnique: mockFindUnique },
        phoneOtp: { findFirst: mockFindFirst, update: mockOtpUpdate, findMany: mockOtpFindMany },
        $transaction: mockTxn,
      },
    }))
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
    expect(body.verification).toBeDefined()

    expect(mockFindFirst).toHaveBeenCalled()
    expect(mockOtpUpdate).toHaveBeenCalledWith({ where: { id: 'otp-1' }, data: { consumed: true } })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'stu-1' },
      data: {
        parentVerifiedAt: expect.any(Date),
        parentPhoneVerifiedAt: expect.any(Date),
        accountStatus: 'active',
      },
    })
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'stu-1' },
      select: { parentEmail: true, parentPhone: true, whatsappPhone: true, name: true },
    })
    expect(mockSendMailSafe).toHaveBeenCalled()
    expect(mockSendSms).toHaveBeenCalled()
  })
})
