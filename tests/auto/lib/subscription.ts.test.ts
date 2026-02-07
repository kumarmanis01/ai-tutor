import fs from 'fs';
import path from 'path';

describe('exists lib/subscription.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/subscription.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
