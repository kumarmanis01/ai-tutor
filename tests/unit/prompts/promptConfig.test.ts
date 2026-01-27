/**
 * FILE OBJECTIVE:
 * - Validate prompts/prompt_config.json structure and value ranges.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/promptConfig.test.ts
 *
 * EDIT LOG:
 * - 2026-01-27T14:05:00Z | copilot | added prompt config validation tests
 */

import fs from 'fs'
import path from 'path'

describe('prompt_config.json', () => {
  const p = path.join(process.cwd(), 'prompts', 'prompt_config.json')

  it('exists and is valid JSON', () => {
    expect(fs.existsSync(p)).toBe(true)
    const raw = fs.readFileSync(p, 'utf8')
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('contains expected keys with numeric temperature and max_tokens', () => {
    const raw = fs.readFileSync(p, 'utf8')
    const cfg = JSON.parse(raw)
    const expected = ['chapters', 'topics', 'notes', 'questions_easy', 'questions_medium', 'questions_hard', 'quality_control']
    for (const key of expected) {
      expect(cfg).toHaveProperty(key)
      const entry = cfg[key]
      expect(entry).toHaveProperty('temperature')
      expect(typeof entry.temperature).toBe('number')
      expect(entry.temperature).toBeGreaterThanOrEqual(0)
      expect(entry.temperature).toBeLessThanOrEqual(1)
      expect(entry).toHaveProperty('max_tokens')
      expect(Number.isInteger(entry.max_tokens)).toBe(true)
      expect(entry.max_tokens).toBeGreaterThan(0)
    }
  })
})
