/**
 * FILE OBJECTIVE:
 * - Unit tests for normalizeStudentAnswerForLogging (whitespace collapse,
 *   truncation, redaction and non-string handling).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/misconception/logHelpers.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-14T00:00:00Z | copilot | add tests for normalizeStudentAnswerForLogging
 */

import normalizeStudentAnswerForLogging from '@/lib/misconception/logHelpers'

jest.mock('@/lib/ai/piiRedaction', () => ({
  // deterministic mock: mask digits and replace emails with [EMAIL]
  redactPIIFromText: (s: string) =>
    String(s).replace(/\d/g, '#').replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '[EMAIL]'),
}))

describe('normalizeStudentAnswerForLogging', () => {
  it('collapses whitespace, truncates to maxLength and redacts PII', () => {
    const raw = '  my phone  is 9876543210 \n email: student@example.com   extra words'
    const out = normalizeStudentAnswerForLogging(raw, 50)
    expect(out).not.toContain('9876543210')
    expect(out).not.toContain('student@example.com')
    expect(out).not.toMatch(/\s{2,}/)
    expect(out.length).toBeLessThanOrEqual(50)
  })

  it('handles non-string and null inputs', () => {
    expect(normalizeStudentAnswerForLogging(null)).toBe('')
    const masked = normalizeStudentAnswerForLogging(123456)
    expect(masked).not.toContain('123456')
  })
})
