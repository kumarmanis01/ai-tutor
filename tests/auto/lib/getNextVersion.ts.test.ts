import fs from 'fs';
import path from 'path';

describe('exists lib/getNextVersion.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/getNextVersion.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
