/**
 * FILE OBJECTIVE:
 * - Verify docs/v2/analytics_user_journey.md exists and contains the FILE OBJECTIVE header.
 *
 * LINKED UNIT TEST:
 * - docs/v2/analytics_user_journey.md
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-21T00:00:00Z | copilot | added presence test for analytics doc
 */

import fs from 'fs';
import path from 'path';

describe('docs/v2/analytics_user_journey.md', () => {
  it('exists and contains FILE OBJECTIVE header', () => {
    const p = path.join(process.cwd(), 'docs', 'v2', 'analytics_user_journey.md');
    const exists = fs.existsSync(p);
    expect(exists).toBe(true);
    if (exists) {
      const content = fs.readFileSync(p, 'utf8');
      expect(content).toMatch(/FILE OBJECTIVE:/);
    }
  });
});
