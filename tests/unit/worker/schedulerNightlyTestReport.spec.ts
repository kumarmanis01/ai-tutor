/**
 * FILE OBJECTIVE:
 * - Validate scheduler wiring for nightly VPS unit+integration test report execution at 00:00 UTC.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/schedulerNightlyTestReport.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created scheduler contract checks for nightly test report automation
 */

describe('scheduler nightly test report wiring', () => {
  it('schedules nightly test report at UTC midnight', async () => {
    const schedulerSource = await import('fs').then((fs) =>
      fs.promises.readFile('worker/scheduler.ts', 'utf8')
    )

    expect(schedulerSource).toContain('NIGHTLY_TEST_REPORT_TARGET_HOUR_UTC = 0')
    expect(schedulerSource).toContain('msUntilNextRun(NIGHTLY_TEST_REPORT_TARGET_HOUR_UTC)')
  })

  it('invokes nightly report job from scheduler', async () => {
    const schedulerSource = await import('fs').then((fs) =>
      fs.promises.readFile('worker/scheduler.ts', 'utf8')
    )

    expect(schedulerSource).toContain('runNightlyTestReportAndEmail')
    expect(schedulerSource).toContain('runNightlyTestReportJob')
    expect(schedulerSource).toContain('setTimeout(runNightlyTestReportJob, delayNightlyTestReport)')
  })
})
