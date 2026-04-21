/**
 * FILE OBJECTIVE:
 * - Verify docs/v2/analytics/analytics_user_journey.md (canonical location) exists
 *   and contains the FILE OBJECTIVE header; verify root-level stub redirects correctly.
 *
 * LINKED UNIT TEST:
 * - docs/v2/analytics/analytics_user_journey.md
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-21T00:00:00Z | copilot | added presence test for analytics doc
 * - 2026-04-21T00:00:00Z | staff-engineer | review fix: point to canonical docs/v2/analytics/ path; root-level stubs
 */

import fs from 'fs';
import path from 'path';

describe('docs/v2/analytics/analytics_user_journey.md (canonical)', () => {
  it('exists and contains FILE OBJECTIVE header', () => {
    const p = path.join(process.cwd(), 'docs', 'v2', 'analytics', 'analytics_user_journey.md');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf8');
    expect(content).toMatch(/FILE OBJECTIVE:/);
  });

  it('root-level stub redirects to canonical location', () => {
    const stub = path.join(process.cwd(), 'docs', 'v2', 'analytics_user_journey.md');
    expect(fs.existsSync(stub)).toBe(true);
    const content = fs.readFileSync(stub, 'utf8');
    expect(content).toContain('analytics/analytics_user_journey.md');
  });
});
