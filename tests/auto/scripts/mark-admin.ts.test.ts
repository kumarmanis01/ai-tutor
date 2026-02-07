import fs from 'fs';
import path from 'path';

describe('exists scripts/mark-admin.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/mark-admin.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
