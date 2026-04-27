/**
 * FILE OBJECTIVE:
 * - Unit tests for trial nudges worker job
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/trialNudges.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add trial nudges worker unit tests
 */

describe('runTrialNudges worker', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('queries trials for each offset and calls sendTemplate with appropriate keys', async () => {
    // Return one trial for each of the three day offsets (2,5,12)
    const trialTemplate = (id: string, phone = '+911111111111') => ({ id, phone, startAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60 * 60), status: 'ACTIVE' })

    const findMany = jest.fn()
      .mockResolvedValueOnce([trialTemplate('t-day2')])
      .mockResolvedValueOnce([trialTemplate('t-day5')])
      .mockResolvedValueOnce([trialTemplate('t-day12')])

    jest.doMock('@/lib/prisma', () => ({ prisma: { trial: { findMany } } }))

    const sendTemplate = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/whatsapp/provider', () => ({ sendTemplate }))

    const TRIAL_TEMPLATES = await import('@/lib/whatsapp/templates')

    const job = await import('@/worker/jobs/trialNudges')
    await job.runTrialNudges()

    // Expect sendTemplate called once per returned trial (3 total)
    expect(sendTemplate).toHaveBeenCalledTimes(3)

    // Verify template keys order (day2, day5, day12)
    const calls = (sendTemplate as jest.Mock).mock.calls
    expect(calls[0][1]).toBe(TRIAL_TEMPLATES.default.DAY_2.key)
    expect(calls[1][1]).toBe(TRIAL_TEMPLATES.default.DAY_5.key)
    expect(calls[2][1]).toBe(TRIAL_TEMPLATES.default.DAY_12.key)
  })
})
