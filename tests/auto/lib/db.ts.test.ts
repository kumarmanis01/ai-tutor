import fs from 'fs';
import path from 'path';

describe('exists lib/db.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/db.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
