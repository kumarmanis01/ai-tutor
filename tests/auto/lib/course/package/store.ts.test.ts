import fs from 'fs';
import path from 'path';

describe('exists lib/course/package/store.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/course/package/store.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
