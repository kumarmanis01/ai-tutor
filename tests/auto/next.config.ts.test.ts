import fs from 'fs';
import path from 'path';

describe('exists next.config.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'next.config.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
