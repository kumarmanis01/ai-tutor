/**
 * FILE OBJECTIVE:
 * - Unit tests for `enforceTutorFreemiumCap` to ensure free-tier checks
 *   behave correctly and throw when limits are reached.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/tutor/enforceFreemium.test.ts
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created
 */

describe('enforceTutorFreemiumCap', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('throws RATE_LIMITED when free-tier disallows', async () => {
    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({ checkFreeTierCap: async () => ({ allowed: false }), incrementFreeTierUsage: async () => {} }))

    const mod = await import('@/services/tutor/turn')
    await expect(mod.enforceTutorFreemiumCap('student-blocked')).rejects.toMatchObject({ message: 'RATE_LIMITED' })
  })

  it('resolves when allowed and increments usage', async () => {
    const inc = jest.fn(async () => {})
    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({ checkFreeTierCap: async () => ({ allowed: true }), incrementFreeTierUsage: inc }))

    const mod = await import('@/services/tutor/turn')
    await expect(mod.enforceTutorFreemiumCap('student-ok')).resolves.toBeUndefined()
    expect(inc).toHaveBeenCalled()
  })
})
