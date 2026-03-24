import { checkOutputSafety, type OutputSafetyResult } from '@/lib/ai/tutor/outputSafety'

const ctx = { studentId: 'student-1', sessionId: 'sess-1', turnId: 'turn-1' }

function expectOneUnsafeEvent(res: OutputSafetyResult, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
  expect(res.safe).toBe(false)
  expect(res.events.length).toBe(1)
  expect(res.events[0]).toMatchObject({
    triggerType: 'UNSAFE_OUTPUT',
    severity,
    studentId: ctx.studentId,
    sessionId: ctx.sessionId,
    turnId: ctx.turnId,
  })
}

describe('checkOutputSafety', () => {
  test('Clean educational response → safe, original, no events', () => {
    const input = 'Let’s solve this step by step. What is the value of x if 2x + 3 = 11?\n[QUESTION]'
    const res = checkOutputSafety(input, ctx)
    expect(res).toEqual({ safe: true, text: input, events: [] })
  })

  test('Response containing sexual content term → replacement, CRITICAL event', () => {
    const res = checkOutputSafety('This contains porn content.', ctx)
    expectOneUnsafeEvent(res, 'CRITICAL')
    expect(res.text).toBe("I can only help with your studies. Let's get back to the topic.")
  })

  test('Response containing self-harm reference → replacement, CRITICAL event', () => {
    const res = checkOutputSafety('Sometimes I want to kill myself.', ctx)
    expectOneUnsafeEvent(res, 'CRITICAL')
    expect(res.text).toBe("I'm here to support your learning. If you're feeling overwhelmed, please talk to a trusted adult.")
  })

  test('Response containing violence term → replacement, HIGH event', () => {
    const res = checkOutputSafety('He threatened to stab someone.', ctx)
    expectOneUnsafeEvent(res, 'HIGH')
    expect(res.text).toBe("Let's stay focused on learning. What part of the topic would you like to explore?")
  })

  test('Response containing substance reference → replacement, MEDIUM event', () => {
    const res = checkOutputSafety('How to get high on weed?', ctx)
    expectOneUnsafeEvent(res, 'MEDIUM')
    expect(res.text).toBe("Let's focus on the topic. What would you like to understand better?")
  })

  test('Response containing personal advice pattern → replacement, LOW event', () => {
    const res = checkOutputSafety('Should I break up with my girlfriend?', ctx)
    expectOneUnsafeEvent(res, 'LOW')
    expect(res.text).toBe("That's outside what I can help with. I'm here for your studies -- what shall we work on?")
  })

  test('Multiple categories matched → highest severity replacement, one event per matched category', () => {
    const res = checkOutputSafety('porn and how to kill myself', ctx)
    expect(res.safe).toBe(false)
    // Two categories: sexual + self-harm
    const severities = res.events.map((e) => e.severity).sort()
    expect(severities).toEqual(['CRITICAL', 'CRITICAL'])
    expect(res.text).toBe("I can only help with your studies. Let's get back to the topic.")
  })

  test('Chemistry terms that look unsafe but are educational are allowed ("oxidation", "acid")', () => {
    const input = 'In chemistry, oxidation is loss of electrons. Acids donate H+ ions.'
    const res = checkOutputSafety(input, ctx)
    expect(res).toEqual({ safe: true, text: input, events: [] })
  })

  test('Historical violence terms are allowed ("World War", "battle")', () => {
    const input = 'World War II included many major battles and changed history.'
    const res = checkOutputSafety(input, ctx)
    expect(res).toEqual({ safe: true, text: input, events: [] })
  })

  test('Empty string → safe, empty output, no events', () => {
    const res = checkOutputSafety('', ctx)
    expect(res).toEqual({ safe: true, text: '', events: [] })
  })

  test('16K char clean input completes quickly (< 50ms)', () => {
    const input = 'A'.repeat(16_000)
    const start = process.hrtime.bigint()
    const res = checkOutputSafety(input, ctx)
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000
    expect(res.safe).toBe(true)
    expect(elapsedMs).toBeLessThan(50)
  })

  test('Raw unsafe text never stored in events payload', () => {
    const unsafe = 'porn 9876543210 user@example.com'
    const res = checkOutputSafety(unsafe, ctx)
    const serialized = JSON.stringify(res.events)
    expect(serialized).not.toContain('porn')
    expect(serialized).not.toContain('9876543210')
    expect(serialized).not.toContain('user@example.com')
  })

  test('Never throws on arbitrary inputs', () => {
    const inputs: any[] = [null, undefined, 42, {}, [], 'clean text']
    for (const i of inputs) {
      expect(() => checkOutputSafety(i as any, ctx)).not.toThrow()
    }
  })
})

