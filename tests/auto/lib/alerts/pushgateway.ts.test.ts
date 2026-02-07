import fs from 'fs';
import path from 'path';

describe('exists lib/alerts/pushgateway.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/alerts/pushgateway.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
