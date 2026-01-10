import fs from 'fs';
import path from 'path';

describe('exists src/regeneration/generatorAdapter.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src', 'regeneration', 'generatorAdapter.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
