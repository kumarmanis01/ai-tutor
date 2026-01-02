import fs from 'fs';
import path from 'path';

test('file exists: app/api/subjects/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/subjects/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
