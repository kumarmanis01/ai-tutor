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
})
