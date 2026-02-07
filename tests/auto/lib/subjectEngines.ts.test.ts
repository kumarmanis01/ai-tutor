import fs from 'fs';
import path from 'path';

describe('exists lib/subjectEngines.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/subjectEngines.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
