import fs from 'fs';
import path from 'path';

describe('exists lib/prisma.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/prisma.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
