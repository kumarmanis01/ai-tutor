import fs from 'fs';
import path from 'path';

describe('exists lib/analyticsClient.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/analyticsClient.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
