import fs from 'fs';
import path from 'path';

test('file exists: app/api/ask/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/ask/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
