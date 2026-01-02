import fs from 'fs';
import path from 'path';

test('file exists: app/api/challenge/submit/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/challenge/submit/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
