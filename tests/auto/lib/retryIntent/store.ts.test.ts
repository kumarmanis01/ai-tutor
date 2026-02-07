import fs from 'fs';
import path from 'path';

describe('exists lib/retryIntent/store.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/retryIntent/store.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
