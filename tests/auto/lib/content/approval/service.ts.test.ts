import fs from 'fs';
import path from 'path';

describe('exists lib/content/approval/service.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/content/approval/service.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
