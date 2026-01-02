import fs from 'fs';
import path from 'path';

test('file exists: app/api/image-caption/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/image-caption/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
