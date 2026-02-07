import fs from 'fs';
import path from 'path';

describe('exists lib/speech.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/speech.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
