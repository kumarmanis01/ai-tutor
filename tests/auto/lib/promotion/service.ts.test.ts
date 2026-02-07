import fs from 'fs';
import path from 'path';

describe('exists lib/promotion/service.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/promotion/service.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
