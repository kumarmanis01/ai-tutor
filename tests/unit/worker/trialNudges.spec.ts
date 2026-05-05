/**
 * FILE OBJECTIVE:
 * - Unit tests for trial nudges worker job
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/trialNudges.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add trial nudges worker unit tests
 * - 2026-05-05T00:00:00Z | claude | fix mock module (sender not provider) + NEXTAUTH_URL guard
 */

describe('runTrialNudges worker', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...OLD_ENV, NEXTAUTH_URL: 'http://localhost:3000' }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('queries trials for each offset and calls sendWhatsAppTemplate with appropriate template names', async () => {
    // Return one trial for each of the three day offsets (2,5,12)
    const trialTemplate = (id: string, phone = '+911111111111') => ({ id, phone, parentName: 'Parent', userId: null, startAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60 * 60), status: 'ACTIVE' })

    const findMany = jest.fn()
      .mockResolvedValueOnce([trialTemplate('t-day2')])
      .mockResolvedValueOnce([trialTemplate('t-day5')])
      .mockResolvedValueOnce([trialTemplate('t-day12')])

    jest.doMock('@/lib/prisma', () => ({ prisma: { trial: { findMany } } }))

    const sendWhatsAppTemplate = jest.fn().mockResolvedValue({ ok: true, messageId: 'msg-1' })
    jest.doMock('@/lib/whatsapp/sender', () => ({ sendWhatsAppTemplate }))

    const TRIAL_TEMPLATES = await import('@/lib/whatsapp/templates')

    const job = await import('@/worker/jobs/trialNudges')
    await job.runTrialNudges()

    // Expect sendWhatsAppTemplate called once per returned trial (3 total)
    expect(sendWhatsAppTemplate).toHaveBeenCalledTimes(3)

    // Verify template names match order (day2, day5, day12)
    const calls = (sendWhatsAppTemplate as jest.Mock).mock.calls
    expect(calls[0][1].name).toBe(TRIAL_TEMPLATES.default.DAY_2.templateName)
    expect(calls[1][1].name).toBe(TRIAL_TEMPLATES.default.DAY_5.templateName)
    expect(calls[2][1].name).toBe(TRIAL_TEMPLATES.default.DAY_12.templateName)
  })
})
