import fs from 'fs';
import path from 'path';

test('file exists: app/api/notes/recent/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/notes/recent/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
