/**
 * FILE OBJECTIVE:
 * - Validate parent OTP gate checks for relevant accountStatus and age combinations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/accountStatus.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | add pending_onboarding coverage and align active casing with Prisma enum values
 */

jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}))

import { requiresParentOTPGate } from '@/lib/student/accountStatus'
import { prisma } from '@/lib/prisma'

const mockedPrisma = prisma as unknown as { user: { findUnique: jest.Mock } }

describe('requiresParentOTPGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns true when accountStatus = pending_parent_verification and age < DPDP_MINOR_AGE', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ accountStatus: 'pending_parent_verification', age: 10 })
    const res = await requiresParentOTPGate('student-1')
    expect(res).toBe(true)
  })

  test('returns false when age is null even if accountStatus pending', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ accountStatus: 'pending_parent_verification', age: null })
    const res = await requiresParentOTPGate('student-2')
    expect(res).toBe(false)
  })

  test('returns true when accountStatus is pending_onboarding and age < DPDP_MINOR_AGE', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ accountStatus: 'pending_onboarding', age: 12 })
    const res = await requiresParentOTPGate('student-3')
    expect(res).toBe(true)
  })

  test('returns false when accountStatus is active', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ accountStatus: 'active', age: 12 })
    const res = await requiresParentOTPGate('student-3')
    expect(res).toBe(false)
  })

  test('returns false when user not found', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null)
    const res = await requiresParentOTPGate('ghost')
    expect(res).toBe(false)
  })
})
