/**
 * FILE OBJECTIVE:
 * - Verify docs/v2/analytics_event_callsites.csv exists and has a header row.
 *
 * LINKED UNIT TEST:
 * - docs/v2/analytics_event_callsites.csv
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-21T00:00:00Z | copilot | added presence test for analytics CSV
 */

import fs from 'fs'
import path from 'path'

describe('docs/v2/analytics_event_callsites.csv', () => {
  it('exists and has CSV header', () => {
    const p = path.join(process.cwd(), 'docs', 'v2', 'analytics_event_callsites.csv')
    const exists = fs.existsSync(p)
    expect(exists).toBe(true)
    if (exists) {
      const content = fs.readFileSync(p, 'utf8')
      expect(content.split('\n').length).toBeGreaterThan(1)
      expect(content).toMatch(/file,\s*line,\s*table,\s*event_type/i)
    }
  })
})
