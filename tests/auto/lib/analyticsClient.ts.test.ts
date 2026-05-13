/**
 * FILE OBJECTIVE:
 * - Verifies that the canonical analytics client source file exists on disk.
 *
 * LINKED UNIT TEST:
 * - tests/auto/lib/analyticsClient.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | update path assertion from lib/analyticsClient.ts to lib/analytics/client.ts; add FILE OBJECTIVE header
 */

import fs from 'fs';
import path from 'path';

describe('exists lib/analytics/client.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/analytics/client.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
