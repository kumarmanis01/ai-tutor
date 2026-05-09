/**
 * FILE OBJECTIVE:
 * - Validate nightly VPS test-report automation command wiring and report rendering contract.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/jobs/nightlyTestReport.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created tests for nightly test command generation and email report payload
 */

import path from 'path'
import { buildNightlyReportEmail, getNightlyTestCommands, type NightlyTestReport } from '@/worker/jobs/nightlyTestReport'

describe('nightlyTestReport automation', () => {
  test('should generate unit and integration commands via shared runner script', () => {
    const repoRoot = path.resolve('d:/projects/ai-tutor')
    const commands = getNightlyTestCommands(repoRoot)

    expect(commands).toHaveLength(2)
    expect(commands[0].name).toBe('unit')
    expect(commands[1].name).toBe('integration')
    expect(commands[0].args[0]).toContain(path.join('scripts', 'run-focused-tests.cjs'))
    expect(commands[1].args).toContain('tests/integration/')
  })

  test('should render PASS report content in text and html', () => {
    const report: NightlyTestReport = {
      startedAtIso: '2026-05-09T00:00:00.000Z',
      finishedAtIso: '2026-05-09T00:05:00.000Z',
      durationMs: 300000,
      allPassed: true,
      results: [
        {
          name: 'unit',
          exitCode: 0,
          durationMs: 120000,
          passed: true,
          stdoutTail: 'unit ok',
          stderrTail: '',
        },
        {
          name: 'integration',
          exitCode: 0,
          durationMs: 180000,
          passed: true,
          stdoutTail: 'integration ok',
          stderrTail: '',
        },
      ],
    }

    const email = buildNightlyReportEmail(report)

    expect(email.subject).toContain('[PASS]')
    expect(email.text).toContain('UNIT: PASS')
    expect(email.text).toContain('INTEGRATION: PASS')
    expect(email.html).toContain('Nightly VPS Test Report (PASS)')
  })

  test('should render FAIL report content when any suite fails', () => {
    const report: NightlyTestReport = {
      startedAtIso: '2026-05-09T00:00:00.000Z',
      finishedAtIso: '2026-05-09T00:05:00.000Z',
      durationMs: 300000,
      allPassed: false,
      results: [
        {
          name: 'unit',
          exitCode: 1,
          durationMs: 120000,
          passed: false,
          stdoutTail: '',
          stderrTail: 'failed tests',
        },
      ],
    }

    const email = buildNightlyReportEmail(report)

    expect(email.subject).toContain('[FAIL]')
    expect(email.text).toContain('UNIT: FAIL')
    expect(email.html).toContain('Nightly VPS Test Report (FAIL)')
  })
})
