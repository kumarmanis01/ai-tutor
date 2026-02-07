import fs from 'fs';
import path from 'path';

describe('exists lib/sms.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/sms.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
