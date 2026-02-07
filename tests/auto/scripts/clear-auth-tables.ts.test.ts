import fs from 'fs';
import path from 'path';

describe('exists scripts/clear-auth-tables.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/clear-auth-tables.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
