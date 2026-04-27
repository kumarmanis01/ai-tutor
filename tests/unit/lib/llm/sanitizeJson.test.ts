import llmSanitizer, { sanitizeTextForJson, extractJsonSpan, parseLlmJson } from '@/lib/llm/sanitizeJson'

describe('llm sanitizeJson utilities', () => {
  test('sanitizeTextForJson strips fences and backticks', () => {
    const s1 = '```json\n{"a":1}\n```'
    expect(sanitizeTextForJson(s1)).toBe('{"a":1}')

    const s2 = '~~~\n{"b":2}\n~~~'
    expect(sanitizeTextForJson(s2)).toBe('{"b":2}')

    const s3 = '`{"c":3}`'
    expect(sanitizeTextForJson(s3)).toBe('{"c":3}')
  })

  test('extractJsonSpan finds fenced and inline JSON', () => {
    const fenced = 'prefix\n```json\n{"x":10}\n```\nsuffix'
    expect(extractJsonSpan(fenced)).toBe('{"x":10}')

    const inline = 'here is object {"k":true} and text'
    expect(extractJsonSpan(inline)).toBe('{"k":true}')

    const arr = 'stuff [1,2,3] end'
    expect(extractJsonSpan(arr)).toBe('[1,2,3]')
  })

  test('parseLlmJson parses valid JSON and throws on bad input', () => {
    expect(parseLlmJson('{"ok":true}')).toEqual({ ok: true })
    expect(parseLlmJson('```json\n{"n":5}\n```')).toEqual({ n: 5 })

    // intentionally broken JSON that cannot be repaired
    expect(() => parseLlmJson('not json at all')).toThrow(/parse_error/)
  })
})
