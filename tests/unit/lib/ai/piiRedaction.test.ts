/**
 * Unit tests for lib/ai/piiRedaction.ts
 * F-ADM-040 AC-05: defence-in-depth PII scrubbing before AI provider calls.
 */
import { redactPIIFromText, redactPIIFromMessages } from '@/lib/ai/piiRedaction'

describe('redactPIIFromText', () => {
  describe('Indian mobile numbers', () => {
    test('redacts 10-digit mobile starting with 6-9', () => {
      expect(redactPIIFromText('call me at 9876543210')).toBe('call me at [MOBILE]')
    })
    test('redacts mobile starting with 6', () => {
      expect(redactPIIFromText('number: 6012345678')).toBe('number: [MOBILE]')
    })
    test('does not redact numbers starting with 0-5', () => {
      const text = 'the answer is 5123456789'
      expect(redactPIIFromText(text)).toBe(text)
    })
    test('redacts multiple mobiles in one string', () => {
      const result = redactPIIFromText('call 9876543210 or 8765432109')
      expect(result).toBe('call [MOBILE] or [MOBILE]')
    })
  })

  describe('email addresses', () => {
    test('redacts basic email', () => {
      expect(redactPIIFromText('email: student@school.com')).toBe('email: [EMAIL]')
    })
    test('redacts email with dots and plus', () => {
      expect(redactPIIFromText('my.email+tag@example.co.in is mine')).toBe('my [EMAIL] is mine')
    })
    test('redacts multiple emails', () => {
      const result = redactPIIFromText('a@b.com and c@d.org')
      expect(result).toBe('[EMAIL] and [EMAIL]')
    })
  })

  describe('Aadhaar numbers', () => {
    test('redacts 12-digit Aadhaar without spaces', () => {
      expect(redactPIIFromText('aadhaar 123456789012 submitted')).toBe('aadhaar [AADHAAR] submitted')
    })
    test('redacts Aadhaar with spaces every 4 digits', () => {
      expect(redactPIIFromText('id: 1234 5678 9012')).toBe('id: [AADHAAR]')
    })
    test('does not redact non-Aadhaar numbers like 8-digit', () => {
      const text = 'roll number 12345678'
      expect(redactPIIFromText(text)).toBe(text)
    })
  })

  describe('combined redaction', () => {
    test('redacts mobile and email in same string', () => {
      const result = redactPIIFromText('mobile 9876543210 and email test@example.com')
      expect(result).toContain('[MOBILE]')
      expect(result).toContain('[EMAIL]')
      expect(result).not.toContain('9876543210')
      expect(result).not.toContain('test@example.com')
    })
    test('leaves clean pedagogical text unchanged', () => {
      const text = 'What is the formula for area of a circle?'
      expect(redactPIIFromText(text)).toBe(text)
    })
  })

  describe('edge cases', () => {
    test('handles empty string', () => {
      expect(redactPIIFromText('')).toBe('')
    })
    test('handles null without throwing', () => {
      expect(() => redactPIIFromText(null as any)).not.toThrow()
    })
    test('handles undefined without throwing', () => {
      expect(() => redactPIIFromText(undefined as any)).not.toThrow()
    })
    test('handles very long string', () => {
      const base = 'hello world '.repeat(500)
      expect(redactPIIFromText(base)).toBe(base)
    })
    test('handles string with only whitespace', () => {
      expect(redactPIIFromText('   ')).toBe('   ')
    })
  })
})

describe('redactPIIFromMessages', () => {
  test('redacts PII from user message content', () => {
    const msgs = [
      { role: 'user', content: 'my mobile is 9876543210' },
    ]
    const result = redactPIIFromMessages(msgs)
    expect(result[0].content).toBe('my mobile is [MOBILE]')
  })

  test('redacts PII across all messages', () => {
    const msgs = [
      { role: 'system', content: 'context with email admin@site.com' },
      { role: 'user', content: 'my number 9123456789' },
    ]
    const result = redactPIIFromMessages(msgs)
    expect(result[0].content).not.toContain('admin@site.com')
    expect(result[0].content).toContain('[EMAIL]')
    expect(result[1].content).toContain('[MOBILE]')
  })

  test('preserves role and extra fields unchanged', () => {
    const msgs = [{ role: 'system', content: 'no pii here', extra: 'value' } as any]
    const result = redactPIIFromMessages(msgs)
    expect(result[0].role).toBe('system')
    expect((result[0] as any).extra).toBe('value')
  })

  test('preserves clean content unchanged', () => {
    const msgs = [{ role: 'assistant', content: 'Photosynthesis converts light to energy.' }]
    const result = redactPIIFromMessages(msgs)
    expect(result[0].content).toBe('Photosynthesis converts light to energy.')
  })

  test('returns non-array input unchanged without throwing', () => {
    expect(() => redactPIIFromMessages(null as any)).not.toThrow()
    expect(redactPIIFromMessages(null as any)).toBeNull()
  })

  test('handles empty array', () => {
    expect(redactPIIFromMessages([])).toEqual([])
  })
})
