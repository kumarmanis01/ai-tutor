import { generateContrastiveExplanation } from '@/lib/ai/tutor/contrastive'

describe('generateContrastiveExplanation', () => {
  it('returns expected artifact shape for a minimal misconception', () => {
    const mis = {
      id: 'M1',
      name: 'Test confusion',
      triggerPatterns: ['pattern'],
      correction: 'Use the correct idea X.',
      description: 'Commonly confuses X with Y.',
    }
    const art = generateContrastiveExplanation(mis as any)
    expect(art).toHaveProperty('misconceptionId', 'M1')
    expect(art).toHaveProperty('name', 'Test confusion')
    expect(art).toHaveProperty('correction', 'Use the correct idea X.')
    expect(typeof art.applyTip).toBe('string')
    expect(typeof art.suggestedPractice).toBe('string')
  })
})
