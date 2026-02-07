import fs from 'fs';
import path from 'path';

describe('exists lib/guards/noStringFilters.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/guards/noStringFilters.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
