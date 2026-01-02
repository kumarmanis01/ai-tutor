import fs from 'fs';
import path from 'path';

test('file exists: app/api/learn/progress/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/learn/progress/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
