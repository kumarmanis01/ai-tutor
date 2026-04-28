import fs from 'fs';
import path from 'path';

describe('exists proxy.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'proxy.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
