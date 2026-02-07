import fs from 'fs';
import path from 'path';

describe('exists middleware.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'middleware.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
