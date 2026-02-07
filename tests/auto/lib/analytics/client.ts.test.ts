import fs from 'fs';
import path from 'path';

describe('exists lib/analytics/client.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/analytics/client.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
