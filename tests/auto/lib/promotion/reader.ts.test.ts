import fs from 'fs';
import path from 'path';

describe('exists lib/promotion/reader.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/promotion/reader.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
