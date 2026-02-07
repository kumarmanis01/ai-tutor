import fs from 'fs';
import path from 'path';

describe('exists lib/redis.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/redis.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
