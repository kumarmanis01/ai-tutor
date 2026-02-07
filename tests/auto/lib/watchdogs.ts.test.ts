import fs from 'fs';
import path from 'path';

describe('exists lib/watchdogs.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/watchdogs.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
