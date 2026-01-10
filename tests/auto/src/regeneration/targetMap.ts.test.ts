import fs from 'fs';
import path from 'path';

describe('exists src/regeneration/targetMap.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src', 'regeneration', 'targetMap.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
