import fs from 'fs';
import path from 'path';

describe('exists lib/rateLimit.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/rateLimit.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
