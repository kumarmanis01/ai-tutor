import fs from 'fs';
import path from 'path';

describe('exists lib/content/project/generator.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/content/project/generator.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
