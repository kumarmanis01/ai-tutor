import fs from 'fs';
import path from 'path';

test('file exists: app/api/user/refresh-session/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/user/refresh-session/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
