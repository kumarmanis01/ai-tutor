import fs from 'fs';
import path from 'path';

describe('exists lib/mailer.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/mailer.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
