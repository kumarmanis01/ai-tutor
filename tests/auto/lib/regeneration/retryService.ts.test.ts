import fs from 'fs';
import path from 'path';

describe('exists lib/regeneration/retryService.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/regeneration/retryService.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
