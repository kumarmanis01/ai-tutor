import fs from 'fs';
import path from 'path';

describe('exists lib/payments.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/payments.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
