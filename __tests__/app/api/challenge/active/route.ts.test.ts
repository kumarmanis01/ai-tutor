import fs from 'fs';
import path from 'path';

test('file exists: app/api/challenge/active/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/challenge/active/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
