import fs from 'fs';
import path from 'path';

test('file exists: app/api/free-questions/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/free-questions/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
