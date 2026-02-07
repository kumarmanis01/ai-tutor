import fs from 'fs';
import path from 'path';

describe('exists lib/content/project/types.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/content/project/types.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
