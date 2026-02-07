import fs from 'fs';
import path from 'path';

describe('exists lib/syllabus/generator.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/syllabus/generator.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
