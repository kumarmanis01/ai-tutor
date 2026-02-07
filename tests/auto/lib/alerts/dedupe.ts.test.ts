import fs from 'fs';
import path from 'path';

describe('exists lib/alerts/dedupe.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/alerts/dedupe.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
