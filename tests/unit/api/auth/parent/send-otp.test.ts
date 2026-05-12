/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/auth/parent/send-otp channel-specific OTP creation and dispatch.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/auth/parent/send-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | add send-otp tests for independent email and WhatsApp OTP generation
 */

describe('POST /api/auth/parent/send-otp', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('creates OTP records for both channels when both are configured', async () => {
    const mockFindUnique = jest.fn(async () => ({
      parentEmail: 'parent@example.com',
      parentWhatsappPhone: '919999999999',
      name: 'Aarav',
    }))
    const mockCount = jest.fn(async () => 0)
    const mockCreate = jest.fn(async () => ({ id: 'otp-id' }))

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
    jest.doMock('@/lib/middleware/authRateLimit', () => ({
      checkAuthRateLimit: jest.fn(async () => ({ allowed: true })),
      createRateLimitResponse: jest.fn(),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: mockFindUnique },
        phoneOtp: { count: mockCount, create: mockCreate },
      },
    }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: jest.fn(async () => undefined) }))
    jest.doMock('@/lib/whatsapp/sender', () => ({ sendWhatsAppSafe: jest.fn(async () => undefined) }))
    jest.doMock('@/lib/parent/contactLinking', () => ({
      resolveParentChannels: jest.fn(() => ({
        normalizedEmail: 'parent@example.com',
        resolvedWhatsappDigits: '919999999999',
        hasEmail: true,
        hasWhatsapp: true,
      })),
      channelOtpKeyByType: jest.fn((channel: 'email' | 'whatsapp') => `${channel}:key`),
      getParentChannelVerificationStatus: jest.fn(async () => ({
        accountVerified: false,
        email: { configured: true, verified: false, masked: 'p***t@example.com' },
        whatsapp: { configured: true, verified: false, masked: '+** *****9999' },
      })),
    }))

    const route = await import('@/app/api/auth/parent/send-otp/route')

    const req = new Request('http://localhost/api/auth/parent/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const res: any = await route.POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sent).toBe(true)
    expect(body.sentTo.email).toBe('parent@example.com')
    expect(body.sentTo.whatsapp).toBe('919999999999')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})
