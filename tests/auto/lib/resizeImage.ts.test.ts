import fs from 'fs';
import path from 'path';

describe('exists lib/resizeImage.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/resizeImage.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
