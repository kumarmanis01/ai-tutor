import { parseTutorTag, stripTag } from '@/lib/ai/tutor/tagParser'
import type { TutorTag } from '@/lib/ai/tutor/stateMachine'

describe('parseTutorTag', () => {
  const allTags: TutorTag[] = [
    'QUESTION',
    'VALIDATE',
    'HINT_OFFER',
    'STAGE_ADVANCE',
    'PREREQ_FAIL',
    'STRUGGLE_DETECTED',
    'MASTERY_CONFIRMED',
  ]

  test('parses QUESTION at end of response', () => {
    const input = 'explanation\n[QUESTION]'
    expect(parseTutorTag(input)).toBe('QUESTION')
    expect(stripTag(input)).toBe('explanation')
  })

  test('parses STAGE_ADVANCE at end of response', () => {
    const input = 'explanation\n[STAGE_ADVANCE]'
    expect(parseTutorTag(input)).toBe('STAGE_ADVANCE')
    expect(stripTag(input)).toBe('explanation')
  })

  test('all 7 valid tags parse correctly and strip body', () => {
    for (const tag of allTags) {
      const input = `body line\n[${tag}]`
      expect(parseTutorTag(input)).toBe(tag)
      expect(stripTag(input)).toBe('body line')
    }
  })

  test('invalid tag name returns null and stripTag is no-op', () => {
    const input = 'explanation\n[INVALID]'
    expect(parseTutorTag(input)).toBeNull()
    expect(stripTag(input)).toBe(input)
  })

  test('tag in body but not on last non-empty line is ignored', () => {
    const input = '[QUESTION] in body\nno tag last line'
    expect(parseTutorTag(input)).toBeNull()
    expect(stripTag(input)).toBe(input)
  })

  test('no tag at all returns null and original string', () => {
    const input = 'no tag at all'
    expect(parseTutorTag(input)).toBeNull()
    expect(stripTag(input)).toBe(input)
  })

  test('empty string returns null and empty string', () => {
    const input = ''
    expect(parseTutorTag(input)).toBeNull()
    expect(stripTag(input)).toBe('')
  })

  test('string with only whitespace returns null and trimmed empty', () => {
    const input = '   '
    expect(parseTutorTag(input)).toBeNull()
    expect(stripTag(input)).toBe('')
  })

  test('handles trailing newline after tag', () => {
    const input = 'text\n[QUESTION]\n'
    expect(parseTutorTag(input)).toBe('QUESTION')
    expect(stripTag(input)).toBe('text')
  })

  test('handles Windows CRLF endings', () => {
    const input = 'text\r\n[MASTERY_CONFIRMED]'
    expect(parseTutorTag(input)).toBe('MASTERY_CONFIRMED')
    // stripTag normalizes internal newlines, but content should match logically
    expect(stripTag(input)).toBe('text')
  })

  test('lowercase tag is invalid', () => {
    const input = '[question]'
    expect(parseTutorTag(input)).toBeNull()
    expect(stripTag(input)).toBe(input)
  })

  test('tag line with extra text is invalid', () => {
    const input = '[QUESTION] extra text'
    expect(parseTutorTag(input)).toBeNull()
    expect(stripTag(input)).toBe(input)
  })

  test('stripTag never mutates input string', () => {
    const input = 'line\n[QUESTION]'
    const copy = `${input}`
    stripTag(input)
    expect(input).toBe(copy)
  })

  test('parseTutorTag never throws on arbitrary input', () => {
    const inputs = [null, undefined, 123, {}, [], '[QUESTION]', 'text']
    for (const v of inputs as any[]) {
      expect(() => parseTutorTag(v as any)).not.toThrow()
    }
  })

  test('stripTag never throws on arbitrary input', () => {
    const inputs = [null, undefined, 123, {}, [], '[QUESTION]', 'text']
    for (const v of inputs as any[]) {
      expect(() => stripTag(v as any)).not.toThrow()
    }
  })
})

