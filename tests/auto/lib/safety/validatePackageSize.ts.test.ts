import fs from 'fs';
import path from 'path';

describe('exists lib/safety/validatePackageSize.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/safety/validatePackageSize.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
