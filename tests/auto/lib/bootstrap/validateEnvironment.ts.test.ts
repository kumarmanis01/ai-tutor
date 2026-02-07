import fs from 'fs';
import path from 'path';

describe('exists lib/bootstrap/validateEnvironment.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/bootstrap/validateEnvironment.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
