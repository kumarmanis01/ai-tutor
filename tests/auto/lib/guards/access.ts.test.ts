import fs from 'fs';
import path from 'path';

describe('exists lib/guards/access.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/guards/access.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
