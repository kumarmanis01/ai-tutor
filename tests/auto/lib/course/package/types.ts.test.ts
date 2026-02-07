import fs from 'fs';
import path from 'path';

describe('exists lib/course/package/types.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/course/package/types.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
