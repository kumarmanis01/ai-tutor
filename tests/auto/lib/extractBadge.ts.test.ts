import fs from 'fs';
import path from 'path';

describe('exists lib/extractBadge.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/extractBadge.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
