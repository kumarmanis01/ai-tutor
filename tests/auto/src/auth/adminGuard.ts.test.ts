import fs from 'fs';
import path from 'path';

describe('exists src/auth/adminGuard.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src', 'auth', 'adminGuard.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
