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

  test('returns false when accountStatus is active', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ accountStatus: 'ACTIVE', age: 12 })
    const res = await requiresParentOTPGate('student-3')
    expect(res).toBe(false)
  })

  test('returns false when user not found', async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null)
    const res = await requiresParentOTPGate('ghost')
    expect(res).toBe(false)
  })
})
