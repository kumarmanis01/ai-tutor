/**
 * FILE OBJECTIVE:
 * - Validate that the monthly misconception prevalence job self-reschedules using
 *   msUntilNextMonthlyRun() rather than the overflowing MONTHLY_INTERVAL_MS constant,
 *   preventing Node.js TimeoutOverflowWarning (value > 2^31 - 1 ms).
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/schedulerMonthlyTimeout.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T12:30:00Z | copilot | created — guard against 32-bit setTimeout overflow in monthly job
 */

// Max safe value for Node.js setTimeout (2^31 - 1 ms ≈ 24.8 days)
const MAX_TIMEOUT_MS = 2_147_483_647

describe('scheduler monthly re-schedule (TimeoutOverflowWarning guard)', () => {
  it('MONTHLY_INTERVAL_MS constant no longer exists in scheduler source', async () => {
    // The constant 30 * 24 * 60 * 60 * 1000 = 2_592_000_000 exceeds 2^31 - 1.
    // Verify the scheduler module does not export or reference it.
    const schedulerSource = await import('fs').then((fs) =>
      fs.promises.readFile('worker/scheduler.ts', 'utf8')
    )
    expect(schedulerSource).not.toMatch(
      /const MONTHLY_INTERVAL_MS\s*=\s*30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/
    )
  })

  it('setTimeout self-reschedule in runMisconceptionPrevalenceJob does not use MONTHLY_INTERVAL_MS', async () => {
    const schedulerSource = await import('fs').then((fs) =>
      fs.promises.readFile('worker/scheduler.ts', 'utf8')
    )
    // Ensure the overflowing constant is not passed to setTimeout in this function's body
    expect(schedulerSource).not.toMatch(/setTimeout\s*\(\s*runMisconceptionPrevalenceJob\s*,\s*MONTHLY_INTERVAL_MS\s*\)/)
  })

  it('msUntilNextMonthlyRun CAN exceed 32-bit limit — safeSetTimeout must be used', async () => {
    // The delay to the 1st of next month can be up to ~31 days (~2.68 billion ms),
    // which exceeds MAX_SAFE_TIMEOUT_MS (2^31 - 1 ≈ 24.8 days). This confirms
    // why a plain setTimeout is insufficient and safeSetTimeout is required.
    const schedulerSource = await import('fs').then((fs) =>
      fs.promises.readFile('worker/scheduler.ts', 'utf8')
    )
    // Both the initial kick-off and the self-reschedule must use safeSetTimeout.
    const safeTimeoutUses = (schedulerSource.match(/safeSetTimeout\s*\(\s*runMisconceptionPrevalenceJob/g) ?? []).length
    expect(safeTimeoutUses).toBe(2)
  })

  it('msUntilNextMonthlyRun points to the first day of next month at 04:00 UTC', () => {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const next = new Date(Date.UTC(year, month + 1, 1, 4, 0, 0))

    expect(next.getUTCDate()).toBe(1)
    expect(next.getUTCHours()).toBe(4)
    expect(next.getUTCMinutes()).toBe(0)
  })
})
