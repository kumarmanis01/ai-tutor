import fs from 'fs';
import path from 'path';

describe('exists lib/tutorStyles.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/tutorStyles.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
