import fs from 'fs';
import path from 'path';

describe('exists worker/loop.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'worker', 'loop.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
