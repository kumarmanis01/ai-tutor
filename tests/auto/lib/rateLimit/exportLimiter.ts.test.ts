import fs from 'fs';
import path from 'path';

describe('exists lib/rateLimit/exportLimiter.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/rateLimit/exportLimiter.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
