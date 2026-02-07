import fs from 'fs';
import path from 'path';

describe('exists lib/promotion/store.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/promotion/store.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
