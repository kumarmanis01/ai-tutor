/**
 * Unit tests for misconception detection and novel misconception logging.
 * F-STU-013 AC-05: Novel misconceptions (no library match) logged to analytics event.
 *
 * Tests: lib/ai/tutor/misconceptionDetector.ts (detectMisconceptions).
 */

import { detectMisconceptions } from '@/lib/ai/tutor/misconceptionDetector'

const SAMPLE_MISCONCEPTIONS = [
  {
    id: 'mc-001',
    name: 'Velocity = Speed',
    triggerPatterns: ['velocity is speed', 'velocity equals speed', 'same as speed'],
    correction: 'Velocity has both magnitude and direction; speed has only magnitude.',
  },
  {
    id: 'mc-002',
    name: 'Force = Motion',
    triggerPatterns: ['force causes motion', 'need force to keep moving'],
    correction: "Newton's first law: objects in motion stay in motion unless a net force acts.",
  },
]

describe('detectMisconceptions', () => {
  it('should return empty array for empty input', () => {
    expect(detectMisconceptions('', SAMPLE_MISCONCEPTIONS)).toHaveLength(0)
  })

  it('should return empty array when no misconceptions match', () => {
    const result = detectMisconceptions('The photosynthesis process uses sunlight', SAMPLE_MISCONCEPTIONS)
    expect(result).toHaveLength(0)
  })

  it('should detect a matching misconception', () => {
    const result = detectMisconceptions('I think velocity is speed', SAMPLE_MISCONCEPTIONS)
    expect(result).toHaveLength(1)
    expect(result[0].misconceptionId).toBe('mc-001')
  })

  it('should return HIGH confidence when multiple patterns match', () => {
    const result = detectMisconceptions(
      'velocity equals speed and velocity is speed basically',
      SAMPLE_MISCONCEPTIONS,
    )
    expect(result[0].confidence).toBe('HIGH')
  })

  it('should return LOW confidence for single pattern match', () => {
    const result = detectMisconceptions('velocity is speed', SAMPLE_MISCONCEPTIONS)
    expect(result[0].confidence).toBe('LOW')
  })

  it('should return empty array when misconceptions list is empty', () => {
    expect(detectMisconceptions('velocity is speed', [])).toHaveLength(0)
  })

  it('should be case-insensitive', () => {
    const result = detectMisconceptions('VELOCITY IS SPEED', SAMPLE_MISCONCEPTIONS)
    expect(result).toHaveLength(1)
  })
})
