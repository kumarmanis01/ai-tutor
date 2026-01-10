import fs from 'fs';
import path from 'path';

describe('exists hydrators/personalizeContent.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'hydrators', 'personalizeContent.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
