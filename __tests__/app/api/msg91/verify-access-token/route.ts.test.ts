import fs from 'fs';
import path from 'path';

test('file exists: app/api/msg91/verify-access-token/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/msg91/verify-access-token/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
