import fs from 'fs';
import path from 'path';

describe('exists lib/realtime.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/realtime.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
