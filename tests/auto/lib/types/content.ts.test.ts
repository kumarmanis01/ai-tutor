import fs from 'fs';
import path from 'path';

describe('exists lib/types/content.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/types/content.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
