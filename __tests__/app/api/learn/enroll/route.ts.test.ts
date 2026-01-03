import fs from 'fs';
import path from 'path';

test('file exists: app/api/learn/enroll/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/learn/enroll/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
