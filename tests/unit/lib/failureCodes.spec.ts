import { formatLastError, formatChildFailure, inferFailureCodeFromMessage, FailureCode } from '@/lib/failureCodes'

describe('failureCodes helpers', () => {
  test('formatLastError produces <CODE>::<msg> pattern and truncates', () => {
    const s = formatLastError(FailureCode.PARSE_FAILED, 'this is an error message\nwith newlines')
    expect(typeof s).toBe('string')
    expect(s).toMatch(/^PARSE_FAILED::this is an error message/)
    expect(s.length).toBeLessThanOrEqual(210)
  })

  test('formatChildFailure composes CHILD_FAILED string', () => {
    const s = formatChildFailure('child-123', 'QUESTIONS', FailureCode.VALIDATION_FAILED)
    expect(s).toBe('CHILD_FAILED::QUESTIONS(child-123)::VALIDATION_FAILED')
  })

  test('inferFailureCodeFromMessage maps common messages', () => {
    expect(inferFailureCodeFromMessage('request timed out')).toBe(FailureCode.LLM_TIMEOUT)
    expect(inferFailureCodeFromMessage('rate limit exceeded')).toBe(FailureCode.LLM_RATE_LIMIT)
    expect(inferFailureCodeFromMessage('could not parse json')).toBe(FailureCode.PARSE_FAILED)
    expect(inferFailureCodeFromMessage('missing topic id')).toBe(FailureCode.DEPENDENCY_MISSING)
  })
})
