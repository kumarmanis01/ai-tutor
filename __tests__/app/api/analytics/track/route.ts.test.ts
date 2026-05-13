/**
 * FILE OBJECTIVE:
 * - Verifies that the canonical analytics event ingestion route exists on disk.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/api/analytics/track/route.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | update file existence assertion to new route path app/api/analytics/event/route.ts; add FILE OBJECTIVE header
 */

import fs from 'fs';
import path from 'path';

test('file exists: app/api/analytics/event/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/analytics/event/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
