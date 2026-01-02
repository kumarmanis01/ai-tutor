import fs from 'fs';
import path from 'path';

test('file exists: app/api/courses/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/courses/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
