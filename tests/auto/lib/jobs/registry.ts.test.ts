import fs from 'fs';
import path from 'path';

describe('exists lib/jobs/registry.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/jobs/registry.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
