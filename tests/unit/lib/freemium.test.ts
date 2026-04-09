/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() } }));
jest.mock('@/lib/subscription', () => ({ isPremiumUser: jest.fn() }));

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import { isPremiumUser } from '@/lib/subscription'

describe('freemium checks', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(isPremiumUser as jest.Mock).mockReset()
  })

  it('checkFreeTierCap returns allowed=true when ParentStudent link is paused', async () => {
    ;(isPremiumUser as jest.Mock).mockResolvedValue(false)
    prismaMock.freeTierUsage.findUnique.mockResolvedValue({ studentId: 'student-1', periodStart: new Date('2026-04-01T00:00:00.000Z'), sessionsUsed: 10 })
    prismaMock.parentChildControl.findFirst.mockResolvedValue(null)
    prismaMock.parentStudent.findFirst.mockResolvedValue({ id: 'link-1', studentId: 'student-1', isPaused: true, pausedUntil: new Date('2026-05-01T00:00:00.000Z') })

    const { checkFreeTierCap } = await import('@/lib/freemium')
    const res = await checkFreeTierCap('student-1')
    expect(res.allowed).toBe(true)
    expect(res.sessionsUsed).toBe(10)
  })
})
