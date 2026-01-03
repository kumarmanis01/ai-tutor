import fs from 'fs';
import path from 'path';

test('file exists: src/auth/adminGuard.ts', () => {
  const p = path.join(process.cwd(), 'src/auth/adminGuard.ts');
  expect(fs.existsSync(p)).toBe(true);
});
