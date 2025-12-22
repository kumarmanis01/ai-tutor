import { generateSuggestionsForSignal } from '@/insights/engine'

describe('Insight Engine', () => {
  it('deterministic mapping for LOW_COMPLETION', () => {
    const sig = { id: 's1', type: 'LOW_COMPLETION', courseId: 'c1', targetId: 'l1', payload: { rate: 0.2 } }
    const a = generateSuggestionsForSignal(sig as any)
    const b = generateSuggestionsForSignal(sig as any)
    expect(a).toEqual(b)
    expect(a[0].type).toBe('LOW_COMPLETION')
    // evidenceJson should contain the original signal and payload snapshot
    expect(a[0].evidenceJson.signal.id).toBe('s1')
    expect(a[0].evidenceJson.signal.payload).toEqual({ rate: 0.2 })
  })

  it('throws on unknown signal type', () => {
    expect(() => generateSuggestionsForSignal({ id: 's2', type: 'UNKNOWN' } as any)).toThrow()
  })
})
