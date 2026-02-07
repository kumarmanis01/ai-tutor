import fs from 'fs';
import path from 'path';

describe('exists lib/systemSettings.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/systemSettings.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
