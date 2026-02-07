import fs from 'fs';
import path from 'path';

describe('exists lib/types.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/types.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
