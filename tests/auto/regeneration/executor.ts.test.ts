import fs from 'fs';
import path from 'path';

describe('exists regeneration/executor.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'regeneration/executor.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
