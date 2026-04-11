/**
 * FILE OBJECTIVE:
 * - Unit tests for consent helper behaviour: grantConsent and withdrawConsent.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/consent.check.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | add tests for consent capture and withdrawal-trigger
 */

// Prisma mock — provide only the methods used by the consent helper
const prismaMock: any = {
  consent: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  deletionRequest: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  user: {
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() } }))

import { grantConsent, withdrawConsent, ConsentScope } from '@/lib/consent/check'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('grantConsent', () => {
  it('saves ipAddress and userAgent to the consent record (create path)', async () => {
    prismaMock.consent.upsert.mockResolvedValueOnce({})

    await grantConsent('user-1', [ConsentScope.AI_INTERACTION], { ipAddress: '1.2.3.4', userAgent: 'test-agent', version: '1.0' })

    expect(prismaMock.consent.upsert).toHaveBeenCalled()
    const callArg = prismaMock.consent.upsert.mock.calls[0][0]
    expect(callArg).toBeTruthy()
    // Ensure the create payload contains the IP and user agent
    expect(callArg.create).toEqual(expect.objectContaining({ ipAddress: '1.2.3.4', userAgent: 'test-agent' }))
    // Ensure the update payload also records the IP/userAgent when re-granting
    expect(callArg.update).toEqual(expect.objectContaining({ ipAddress: '1.2.3.4', userAgent: 'test-agent' }))
  })
})

describe('withdrawConsent', () => {
  it('initiates deletion request and sets accountStatus to deletion_pending for DATA_PROCESSING', async () => {
    prismaMock.consent.updateMany.mockResolvedValueOnce({ count: 1 })
    prismaMock.deletionRequest.findUnique.mockResolvedValueOnce(null)
    prismaMock.deletionRequest.create.mockResolvedValueOnce({ id: 'del-1' })
    prismaMock.user.update.mockResolvedValueOnce({ accountStatus: 'deletion_pending' })
    prismaMock.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' })
    prismaMock.$transaction.mockResolvedValueOnce([ { id: 'del-1' }, { accountStatus: 'deletion_pending' }, { id: 'audit-1' } ])

    await withdrawConsent('user-2', ConsentScope.DATA_PROCESSING, { ipAddress: '5.6.7.8' })

    expect(prismaMock.consent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-2', scope: ConsentScope.DATA_PROCESSING, withdrawnAt: null }),
        data: expect.objectContaining({ withdrawnAt: expect.any(Date) }),
      }),
    )

    expect(prismaMock.deletionRequest.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-2' } }))
    // Creation and account update should be invoked (they are executed before $transaction receives the promises)
    expect(prismaMock.deletionRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'user-2' } }))
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-2' }, data: expect.objectContaining({ accountStatus: 'deletion_pending' }) }))
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ERASURE_REQUEST', ipAddress: '5.6.7.8' }) }))
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })
})
