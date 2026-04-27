/**
 * FILE OBJECTIVE:
 * - Verify docs/v2/analytics/MASTER.md exists and contains the required
 *   FILE OBJECTIVE header (keeping the docs set consistent and grep-friendly).
 *
 * LINKED UNIT TEST:
 * - docs/v2/analytics/MASTER.md
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | review fix: create test referenced in MASTER.md header
 */

import fs from 'fs'
import path from 'path'

describe('docs/v2/analytics/MASTER.md', () => {
  it('exists and contains FILE OBJECTIVE header', () => {
    const p = path.join(process.cwd(), 'docs', 'v2', 'analytics', 'MASTER.md')
    expect(fs.existsSync(p)).toBe(true)
    const content = fs.readFileSync(p, 'utf8')
    expect(content).toMatch(/FILE OBJECTIVE:/i)
  })

  it('lists all expected linked analytics documents', () => {
    const p = path.join(process.cwd(), 'docs', 'v2', 'analytics', 'MASTER.md')
    const content = fs.readFileSync(p, 'utf8')
    expect(content).toContain('analytics_admin_audit_report.md')
    expect(content).toContain('analytics_event_callsites.csv')
    expect(content).toContain('analytics_event_reconciliation.md')
    expect(content).toContain('analytics_user_journey.md')
    expect(content).toContain('analytics_performance.md')
  })
})
