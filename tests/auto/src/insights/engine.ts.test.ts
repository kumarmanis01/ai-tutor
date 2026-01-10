import fs from 'fs';
import path from 'path';

describe('exists src/insights/engine.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src', 'insights', 'engine.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
