import fs from 'fs';
import path from 'path';

test('file exists: app/api/auth/verify-code/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/auth/verify-code/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
