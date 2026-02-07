import fs from 'fs';
import path from 'path';

describe('exists lib/content/lesson/prompt.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/content/lesson/prompt.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
