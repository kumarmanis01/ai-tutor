/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/verify-parent/send-otp channel-specific OTP delivery.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/verify-parent/send-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add send-otp tests for separate email and WhatsApp channel OTP generation
 */

describe('POST /api/student/verify-parent/send-otp', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu-1' } }) }))
  })

  it('creates separate OTP records for email and WhatsApp and returns channel payload', async () => {
    const mockFindUnique = jest.fn(async () => ({
      parentEmail: 'parent@example.com',
      parentPhone: '9000000000',
      whatsappPhone: '9000000000',
      name: 'Asha',
    }))
    const mockCount = jest.fn(async () => 0)
    const mockCreate = jest.fn(async () => ({ id: 'otp-id' }))
    const mockFindMany = jest.fn(async () => [])
    const mockSendMailSafe = jest.fn(async () => undefined)
    const mockSendWhatsAppSafe = jest.fn(async () => undefined)

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: mockFindUnique },
        phoneOtp: { count: mockCount, create: mockCreate, findMany: mockFindMany },
      },
    }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: mockSendMailSafe }))
    jest.doMock('@/lib/whatsapp/sender', () => ({ sendWhatsAppSafe: mockSendWhatsAppSafe }))

    const route = await import('@/app/api/student/verify-parent/send-otp/route')

    const req = new Request('http://localhost/api/student/verify-parent/send-otp', { method: 'POST' })
    const res: any = await route.POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sent).toBe(true)
    expect(body.sentTo.email).toBe('parent@example.com')
    expect(body.sentTo.whatsapp).toBe('9000000000')
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockSendMailSafe).toHaveBeenCalled()
    expect(mockSendWhatsAppSafe).toHaveBeenCalled()
  })
})
