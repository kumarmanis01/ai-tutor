import fs from 'fs';
import path from 'path';

describe('exists lib/slug.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/slug.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
