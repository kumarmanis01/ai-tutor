/**
 * FILE OBJECTIVE:
 * - Unit tests for parent contact linking helper utilities.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/parent/contactLinking.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add tests for channel resolution and verification status helpers
 */

import { getParentChannelVerificationStatus, resolveParentChannels } from '@/lib/parent/contactLinking'

describe('parent/contactLinking', () => {
  it('resolves channels from parent email and whatsapp values', () => {
    const result = resolveParentChannels('Parent@Example.com', '+91 90000 00000', null)

    expect(result.hasEmail).toBe(true)
    expect(result.hasWhatsapp).toBe(true)
    expect(result.normalizedEmail).toBe('parent@example.com')
    expect(result.resolvedWhatsappDigits).toBe('919000000000')
  })

  it('computes per-channel verification from consumed OTP records', async () => {
    const prisma = {
      phoneOtp: {
        findMany: jest.fn(async () => [{ phone: 'email:cGFyZW50QGV4YW1wbGUu' }]),
      },
    } as any

    const status = await getParentChannelVerificationStatus({
      prisma,
      studentId: 'stu-1',
      parentEmail: 'parent@example.com',
      whatsappPhone: '9000000000',
      parentPhone: null,
    })

    expect(status.email.verified).toBe(true)
    expect(status.whatsapp.verified).toBe(false)
    expect(status.accountVerified).toBe(true)
  })
})
