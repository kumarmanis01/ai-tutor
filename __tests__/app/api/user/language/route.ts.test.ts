import fs from 'fs';
import path from 'path';

test('file exists: app/api/user/language/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/user/language/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
