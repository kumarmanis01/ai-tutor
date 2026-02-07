import fs from 'fs';
import path from 'path';

describe('exists lib/resolveAcademicIds.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/resolveAcademicIds.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
