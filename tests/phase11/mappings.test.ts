import mapSignalToSuggestions from '@/insights/mappings'

describe('Mapping registry', () => {
  it('maps LOW_COMPLETION to LOW_COMPLETION suggestion with expected severity', () => {
    const sig = { id: 's1', type: 'LOW_COMPLETION', courseId: 'c1', targetId: 'l1', payload: { rate: 0.2 } }
    const suggestions = mapSignalToSuggestions(sig as any)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0].type).toBe('LOW_COMPLETION')
    expect(suggestions[0].severity).toBe('HIGH')
    expect(suggestions[0].evidenceJson.signal.id).toBe('s1')
  })

  it('throws on unknown signal type', () => {
    expect(() => mapSignalToSuggestions({ id: 'x', type: 'UNKNOWN' } as any)).toThrow()
  })
})
