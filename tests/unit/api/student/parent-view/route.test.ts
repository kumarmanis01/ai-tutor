/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/parent-view including auto-linked contact channels and verification statuses.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/parent-view/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add parent-view tests for channel verification fields
 */

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(async () => ({ user: { id: 'stu-1' } })),
}))

jest.mock('@/lib/parent/contactLinking', () => ({
  ensureAutoLinkedParentsForStudent: jest.fn(async () => undefined),
  getParentChannelVerificationStatus: jest.fn(async () => ({
    accountVerified: true,
    email: { configured: true, verified: true, masked: 'p***t@example.com' },
    whatsapp: { configured: true, verified: false, masked: '+** *****0000' },
  })),
  resolveParentChannels: jest.fn(() => ({
    normalizedEmail: 'parent@example.com',
    resolvedWhatsappDigits: '9000000000',
    hasEmail: true,
    hasWhatsapp: true,
  })),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async () => ({
        parentEmail: 'parent@example.com',
        parentPhone: '9000000000',
        whatsappPhone: '9000000000',
      })),
    },
    parentStudent: {
      findMany: jest.fn(async () => []),
    },
    parentInvite: {
      findMany: jest.fn(async () => []),
    },
    attentionFlag: {
      findMany: jest.fn(async () => []),
    },
    readinessStatus: {
      findMany: jest.fn(async () => []),
    },
  },
}))

describe('GET /api/student/parent-view', () => {
  it('returns channel-specific linked parent contact entries', async () => {
    const route = await import('@/app/api/student/parent-view/route')

    const req = new Request('http://localhost/api/student/parent-view')
    const res: any = await route.GET(req as any)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body.linkedParents)).toBe(true)
    expect(body.linkedParents.some((p: any) => p.source === 'contact_email')).toBe(true)
    expect(body.linkedParents.some((p: any) => p.source === 'contact_whatsapp')).toBe(true)
    expect(body.verification.email.verified).toBe(true)
    expect(body.verification.whatsapp.verified).toBe(false)
  })
})
