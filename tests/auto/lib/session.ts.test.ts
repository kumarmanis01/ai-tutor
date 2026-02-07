import fs from 'fs';
import path from 'path';

describe('exists lib/session.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/session.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
