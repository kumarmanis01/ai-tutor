import fs from 'fs';
import path from 'path';

describe('exists src/insights/mappings.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src', 'insights', 'mappings.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
