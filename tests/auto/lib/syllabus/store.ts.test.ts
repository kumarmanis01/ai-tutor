import fs from 'fs';
import path from 'path';

describe('exists lib/syllabus/store.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/syllabus/store.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
