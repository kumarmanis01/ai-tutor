import fs from 'fs';
import path from 'path';

test('file exists: app/api/chapters/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/chapters/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
