import fs from 'fs';
import path from 'path';

describe('exists utils/logApiUsage.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'utils', 'logApiUsage.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
