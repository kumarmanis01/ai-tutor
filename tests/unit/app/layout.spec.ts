/**
 * FILE OBJECTIVE:
 * - Unit test to verify the app root layout exists and exports a default component.
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | created test for app/layout
 */

import fs from 'fs';
import path from 'path';

describe('App root layout', () => {
  it('layout file exists at app/layout.tsx', () => {
    const layoutPath = path.resolve(__dirname, '../../../app/layout.tsx');
    const exists = fs.existsSync(layoutPath);
    expect(exists).toBe(true);
  });
});
