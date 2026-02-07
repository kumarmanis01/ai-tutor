import fs from 'fs';
import path from 'path';

describe('exists lib/normalize.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/normalize.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
