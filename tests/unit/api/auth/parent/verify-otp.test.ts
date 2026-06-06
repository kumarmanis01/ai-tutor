/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/auth/parent/verify-otp channel-specific verification behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/auth/parent/verify-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | add verify-otp tests for channel-aware activation and timestamp updates
 * - 2026-05-17T00:00:00Z | reviewer | add test for verifyCode rate-limit branch returning 429
 */

describe('POST /api/auth/parent/verify-otp', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('verifies email channel OTP and activates account', async () => {
    const mockFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        parentEmail: 'parent@example.com',
        parentWhatsappPhone: '919999999999',
        parentEmailVerifiedAt: null,
        parentWhatsappVerifiedAt: null,
        parentVerifiedAt: null,
      })
    const mockFindFirst = jest.fn().mockResolvedValue({ id: 'otp-1' })
    const mockOtpUpdate = jest.fn().mockResolvedValue({ id: 'otp-1' })
    const mockUserUpdate = jest.fn().mockResolvedValue({ id: 'stu-1' })
    const mockTxn = jest.fn(async (ops: unknown[]) => ops)

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: mockFindUnique, update: mockUserUpdate },
        phoneOtp: { findFirst: mockFindFirst, update: mockOtpUpdate },
        $transaction: mockTxn,
      },
    }))
    jest.doMock('@/lib/parent/contactLinking', () => ({
      resolveParentChannels: jest.fn(() => ({
        normalizedEmail: 'parent@example.com',
        resolvedWhatsappDigits: '919999999999',
        hasEmail: true,
        hasWhatsapp: true,
      })),
      channelOtpKeyByType: jest.fn(() => 'email:key'),
      getParentChannelVerificationStatus: jest.fn(async () => ({
        accountVerified: true,
        email: { configured: true, verified: true, masked: 'p***t@example.com' },
        whatsapp: { configured: true, verified: false, masked: '+** *****9999' },
      })),
    }))

    const route = await import('@/app/api/auth/parent/verify-otp/route')

    const req = new Request('http://localhost/api/auth/parent/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456', channel: 'email' }),
    })

    const res: any = await route.POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.verified).toBe(true)
    expect(body.channel).toBe('email')
    expect(mockFindFirst).toHaveBeenCalled()
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stu-1' },
        data: expect.objectContaining({
          parentEmailVerifiedAt: expect.any(Date),
          parentVerifiedAt: expect.any(Date),
          accountStatus: 'active',
        }),
      }),
    )
  })

  it('rejects whatsapp channel when disabled', async () => {
    jest.resetModules()
    jest.clearAllMocks()

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: {} }))

    const route = await import('@/app/api/auth/parent/verify-otp/route')

    const req = new Request('http://localhost/api/auth/parent/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456', channel: 'whatsapp' }),
    })

    const res: any = await route.POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('WhatsApp verification is currently disabled')
  })

  it('reconciles accountStatus/parentVerifiedAt when already verified but pending', async () => {
    jest.resetModules()
    jest.clearAllMocks()

    // user.parentEmailVerifiedAt set, but parentVerifiedAt null AND session accountStatus
    // is not 'active' -- the alreadyVerified branch must reconcile both and invalidate cache.
    const mockUserUpdate = jest.fn().mockResolvedValue({ id: 'stu-1' })
    const invalidateMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({
        user: { id: 'stu-1', email: 'student@example.com', accountStatus: 'pending_parent_verification' },
      }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            parentEmail: 'parent@example.com',
            parentWhatsappPhone: null,
            parentEmailVerifiedAt: new Date(),
            parentWhatsappVerifiedAt: null,
            parentVerifiedAt: null,
          }),
          update: mockUserUpdate,
        },
        phoneOtp: { findFirst: jest.fn(), update: jest.fn() },
        $transaction: jest.fn(async (ops: unknown[]) => ops),
      },
    }))
    jest.doMock('@/lib/auth', () => ({ invalidateUserSessionCache: invalidateMock }))
    jest.doMock('@/lib/parent/contactLinking', () => ({
      resolveParentChannels: jest.fn(() => ({
        normalizedEmail: 'parent@example.com',
        resolvedWhatsappDigits: '',
        hasEmail: true,
        hasWhatsapp: false,
      })),
      channelOtpKeyByType: jest.fn(() => 'email:key'),
      getParentChannelVerificationStatus: jest.fn(async () => ({
        accountVerified: true,
        email: { configured: true, verified: true, masked: 'p***t@example.com' },
        whatsapp: { configured: false, verified: false, masked: null },
      })),
    }))

    const route = await import('@/app/api/auth/parent/verify-otp/route')

    const req = new Request('http://localhost/api/auth/parent/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456', channel: 'email' }),
    })

    const res: any = await route.POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alreadyVerified).toBe(true)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stu-1' },
        data: expect.objectContaining({
          accountStatus: 'active',
          parentVerifiedAt: expect.any(Date),
        }),
      }),
    )
    expect(invalidateMock).toHaveBeenCalledWith('student@example.com')
  })

  it('does NOT re-update when already verified AND already active', async () => {
    jest.resetModules()
    jest.clearAllMocks()

    const mockUserUpdate = jest.fn().mockResolvedValue({ id: 'stu-1' })

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({
        user: { id: 'stu-1', email: 'student@example.com', accountStatus: 'active' },
      }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            parentEmail: 'parent@example.com',
            parentWhatsappPhone: null,
            parentEmailVerifiedAt: new Date(),
            parentWhatsappVerifiedAt: null,
            parentVerifiedAt: new Date(), // already set -- nothing to reconcile
          }),
          update: mockUserUpdate,
        },
        phoneOtp: { findFirst: jest.fn(), update: jest.fn() },
        $transaction: jest.fn(async (ops: unknown[]) => ops),
      },
    }))
    jest.doMock('@/lib/auth', () => ({ invalidateUserSessionCache: jest.fn() }))
    jest.doMock('@/lib/parent/contactLinking', () => ({
      resolveParentChannels: jest.fn(() => ({
        normalizedEmail: 'parent@example.com',
        resolvedWhatsappDigits: '',
        hasEmail: true,
        hasWhatsapp: false,
      })),
      channelOtpKeyByType: jest.fn(() => 'email:key'),
      getParentChannelVerificationStatus: jest.fn(async () => ({
        accountVerified: true,
        email: { configured: true, verified: true, masked: 'p***t@example.com' },
        whatsapp: { configured: false, verified: false, masked: null },
      })),
    }))

    const route = await import('@/app/api/auth/parent/verify-otp/route')
    const req = new Request('http://localhost/api/auth/parent/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456', channel: 'email' }),
    })

    const res: any = await route.POST(req as any)
    expect(res.status).toBe(200)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('returns 429 when verifyCode rate limit is exceeded', async () => {
    jest.resetModules()
    jest.clearAllMocks()

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: {} }))
    jest.doMock('@/lib/middleware/authRateLimit', () => ({
      checkAuthRateLimit: jest.fn().mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60_000),
        blocked: true,
      }),
      createRateLimitResponse: jest.fn(() =>
        new Response(JSON.stringify({ error: 'Too many requests. Your access has been temporarily blocked.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
        }),
      ),
    }))

    const route = await import('@/app/api/auth/parent/verify-otp/route')
    const { checkAuthRateLimit } = await import('@/lib/middleware/authRateLimit')

    const req = new Request('http://localhost/api/auth/parent/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    })

    const res: any = await route.POST(req as any)

    expect(res.status).toBe(429)
    expect(checkAuthRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'verifyCode',
      expect.stringContaining('parent:stu-1'),
    )
  })
})
