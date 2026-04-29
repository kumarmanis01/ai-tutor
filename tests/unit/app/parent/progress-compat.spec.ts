/**
 * FILE OBJECTIVE:
 * - Ensure the compatibility re-export file for `/parent/progress/[studentId]` exists.
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | created
 */

import fs from 'fs';
import path from 'path';

describe('Parent progress compatibility route', () => {
  it('compat file exists', () => {
    const p = path.resolve(__dirname, '../../../../app/(parent)/parent/progress/[studentId]/page.tsx');
    expect(fs.existsSync(p)).toBe(true);
  });
});
