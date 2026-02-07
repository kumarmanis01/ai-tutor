import fs from 'fs';
import path from 'path';

describe('exists lib/toast.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/toast.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
