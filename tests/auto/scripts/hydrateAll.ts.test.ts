import fs from 'fs';
import path from 'path';

describe('exists scripts/hydrateAll.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/hydrateAll.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
